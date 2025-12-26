import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Ticket,
  TicketDocument,
  TicketStatus,
  TicketReason,
} from './schemas/ticket.schema';
import {
  CreateTicketDto,
  UpdateTicketDto,
  PayTicketDto,
  AppealTicketDto,
} from './dto';
import {
  createLicensePlate,
  parseLicensePlateString,
} from '../shared/license-plate';
import { TicketTokensService } from '../ticket-tokens/ticket-tokens.service';
import { generateUniqueCode } from './utils/generate-unique-code';

export interface TicketWithQrCode {
  ticket: TicketDocument;
  qrCode: {
    token: string;
    qrCodeDataUrl: string;
    qrCodeContent: string;
    expiresAt: Date;
  };
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name)
    private ticketModel: Model<TicketDocument>,
    @Inject(forwardRef(() => TicketTokensService))
    private ticketTokensService: TicketTokensService,
  ) {}

  /**
   * Generate a unique ticket number
   * Format: TKT-YYYYMMDD-XXXXX (e.g., TKT-20241217-00001)
   */
  private async generateTicketNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TKT-${dateStr}-`;

    // Find the last ticket number for today
    const lastTicket = await this.ticketModel
      .findOne({ ticketNumber: { $regex: `^${prefix}` } })
      .sort({ ticketNumber: -1 })
      .exec();

    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(5, '0')}`;
  }

  /**
   * Generate a unique code with collision detection
   * Retries up to maxRetries times if a collision is detected
   */
  private async generateUniqueCodeWithRetry(maxRetries = 5): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const code = generateUniqueCode();
      const exists = await this.ticketModel.exists({ uniqueCode: code });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique code after maximum retries');
  }

  /**
   * Create a new ticket
   */
  async create(createDto: CreateTicketDto): Promise<TicketDocument> {
    const ticketNumber = await this.generateTicketNumber();
    const uniqueCode = await this.generateUniqueCodeWithRetry();

    // Resolve license plate from structured or string format
    const plate = createDto.plate
      ? createLicensePlate(
          createDto.plate.type,
          createDto.plate.left,
          createDto.plate.right,
        )
      : parseLicensePlateString(createDto.licensePlate || '');

    const ticket = new this.ticketModel({
      ...createDto,
      ticketNumber,
      uniqueCode,
      position: {
        type: 'Point',
        coordinates: createDto.position.coordinates,
      },
      parkingSessionId: createDto.parkingSessionId
        ? new Types.ObjectId(createDto.parkingSessionId)
        : undefined,
      userId: createDto.userId
        ? new Types.ObjectId(createDto.userId)
        : undefined,
      agentId: new Types.ObjectId(createDto.agentId),
      parkingZoneId: new Types.ObjectId(createDto.parkingZoneId),
      plate: plate,
      licensePlate: plate.formatted, // Keep for backward compatibility
      status: TicketStatus.PENDING,
    });

    return ticket.save();
  }

  /**
   * Create a new ticket with QR code
   * Returns both the ticket and the QR code for printing
   */
  async createWithQrCode(
    createDto: CreateTicketDto,
  ): Promise<TicketWithQrCode> {
    const ticket = await this.create(createDto);

    // Generate secure token and QR code for the ticket
    const qrCodeResult = await this.ticketTokensService.generateTokenForTicket(
      ticket._id.toString(),
    );

    return {
      ticket,
      qrCode: qrCodeResult,
    };
  }

  /**
   * Find all tickets with optional filters
   */
  async findAll(filters?: {
    userId?: string;
    agentId?: string;
    status?: TicketStatus;
    licensePlate?: string;
    plateLeft?: string;
    plateRight?: string;
    plateType?: string;
    reason?: TicketReason;
    limit?: number;
    skip?: number;
  }): Promise<TicketDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }
    if (filters?.agentId) {
      query.agentId = new Types.ObjectId(filters.agentId);
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.licensePlate) {
      query.licensePlate = filters.licensePlate
        .toUpperCase()
        .replace(/\s/g, '');
    }
    // Partial matching on plate parts (starts-with matching)
    if (filters?.plateLeft) {
      // Escape regex special characters and use starts-with
      const escaped = filters.plateLeft.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query['plate.left'] = { $regex: `^${escaped}`, $options: 'i' };
    }
    if (filters?.plateRight) {
      const escaped = filters.plateRight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query['plate.right'] = { $regex: `^${escaped}`, $options: 'i' };
    }
    // Only filter by type when searching by plate parts
    if (filters?.plateType && (filters?.plateLeft || filters?.plateRight)) {
      query['plate.type'] = filters.plateType;
    }
    if (filters?.reason) {
      query.reason = filters.reason;
    }

    return this.ticketModel
      .find(query)
      .populate('parkingSessionId')
      .populate('agentId')
      .sort({ issuedAt: -1 })
      .skip(filters?.skip || 0)
      .limit(filters?.limit || 50)
      .exec();
  }

  /**
   * Find tickets by user ID
   */
  async findByUserId(
    userId: string,
    options?: { status?: TicketStatus; limit?: number },
  ): Promise<TicketDocument[]> {
    return this.findAll({
      userId,
      status: options?.status,
      limit: options?.limit,
    });
  }

  /**
   * Find tickets by agent ID
   */
  async findByAgentId(
    agentId: string,
    options?: { status?: TicketStatus; limit?: number },
  ): Promise<TicketDocument[]> {
    return this.findAll({
      agentId,
      status: options?.status,
      limit: options?.limit,
    });
  }

  /**
   * Find tickets by license plate
   */
  async findByLicensePlate(
    licensePlate: string,
    options?: { status?: TicketStatus },
  ): Promise<TicketDocument[]> {
    return this.findAll({
      licensePlate,
      status: options?.status,
    });
  }

  /**
   * Find unpaid tickets for a license plate
   */
  async findUnpaidByLicensePlate(
    licensePlate: string,
  ): Promise<TicketDocument[]> {
    const normalizedPlate = licensePlate.toUpperCase().replace(/\s/g, '');
    return this.ticketModel
      .find({
        licensePlate: normalizedPlate,
        status: { $in: [TicketStatus.PENDING, TicketStatus.OVERDUE] },
      })
      .exec();
  }

  /**
   * Find tickets by parking session ID
   */
  async findBySessionId(sessionId: string): Promise<TicketDocument[]> {
    return this.ticketModel
      .find({ parkingSessionId: new Types.ObjectId(sessionId) })
      .exec();
  }

  /**
   * Find a single ticket by ID
   */
  async findOne(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('parkingSessionId')
      .populate('userId')
      .populate('agentId')
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }
    return ticket;
  }

  /**
   * Find a ticket by ticket number
   */
  async findByTicketNumber(ticketNumber: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findOne({ ticketNumber: ticketNumber.toUpperCase() })
      .populate('parkingSessionId')
      .populate('agentId')
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketNumber} not found`);
    }
    return ticket;
  }

  /**
   * Find a ticket by unique code (for manual entry when QR is damaged)
   */
  async findByUniqueCode(code: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findOne({ uniqueCode: code.toUpperCase() })
      .populate('parkingSessionId')
      .populate('agentId')
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket with code ${code} not found`);
    }
    return ticket;
  }

  /**
   * Find tickets near a location
   */
  async findNearby(
    longitude: number,
    latitude: number,
    radiusMeters: number = 1000,
    limit: number = 50,
  ): Promise<TicketDocument[]> {
    return this.ticketModel
      .find({
        position: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusMeters,
          },
        },
      })
      .limit(limit)
      .exec();
  }

  /**
   * Update a ticket
   */
  async update(
    id: string,
    updateDto: UpdateTicketDto,
  ): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }

    return ticket;
  }

  /**
   * Pay a ticket
   */
  async pay(id: string, payDto: PayTicketDto): Promise<TicketDocument> {
    const ticket = await this.findOne(id);

    if (ticket.status === TicketStatus.PAID) {
      throw new BadRequestException('Ticket is already paid');
    }

    if (ticket.status === TicketStatus.DISMISSED) {
      throw new BadRequestException('Cannot pay a dismissed ticket');
    }

    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        {
          status: TicketStatus.PAID,
          paidAt: new Date(),
          paymentMethod: payDto.paymentMethod,
        },
        { new: true },
      )
      .exec();

    // Revoke the ticket token since ticket is now paid
    await this.ticketTokensService.revokeToken(id);

    return updatedTicket!;
  }

  /**
   * Appeal a ticket
   */
  async appeal(
    id: string,
    appealDto: AppealTicketDto,
  ): Promise<TicketDocument> {
    const ticket = await this.findOne(id);

    if (ticket.status === TicketStatus.PAID) {
      throw new BadRequestException('Cannot appeal a paid ticket');
    }

    if (ticket.status === TicketStatus.APPEALED) {
      throw new BadRequestException('Ticket is already under appeal');
    }

    if (ticket.status === TicketStatus.DISMISSED) {
      throw new BadRequestException('Cannot appeal a dismissed ticket');
    }

    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        {
          status: TicketStatus.APPEALED,
          appealReason: appealDto.appealReason,
          appealedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    return updatedTicket!;
  }

  /**
   * Dismiss a ticket (admin action after appeal review)
   */
  async dismiss(id: string): Promise<TicketDocument> {
    const ticket = await this.findOne(id);

    if (ticket.status === TicketStatus.PAID) {
      throw new BadRequestException('Cannot dismiss a paid ticket');
    }

    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(id, { status: TicketStatus.DISMISSED }, { new: true })
      .exec();

    // Revoke the ticket token since ticket is now dismissed
    await this.ticketTokensService.revokeToken(id);

    return updatedTicket!;
  } /**
   * Remove a sabotaged ticket
   */
  async sabotRemove(id: string): Promise<TicketDocument> {
    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        { status: TicketStatus.SABOT_REMOVED },
        { new: true },
      )
      .exec();

    return updatedTicket!;
  }

  /**
   * Delete a ticket
   */
  async remove(id: string): Promise<void> {
    const result = await this.ticketModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }
  }

  /**
   * Update overdue tickets (can be called by a cron job)
   */
  async updateOverdueTickets(): Promise<number> {
    const now = new Date();
    const result = await this.ticketModel
      .updateMany(
        {
          status: TicketStatus.PENDING,
          dueDate: { $lt: now },
        },
        { status: TicketStatus.OVERDUE },
      )
      .exec();

    return result.modifiedCount;
  }

  /**
   * Check if a license plate has unpaid tickets
   */
  async hasUnpaidTickets(licensePlate: string): Promise<boolean> {
    const normalizedPlate = licensePlate.toUpperCase().replace(/\s/g, '');
    const count = await this.ticketModel
      .countDocuments({
        licensePlate: normalizedPlate,
        status: { $in: [TicketStatus.PENDING, TicketStatus.OVERDUE] },
      })
      .exec();

    return count > 0;
  }

  /**
   * Get ticket statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    pending: number;
    paid: number;
    overdue: number;
    totalFines: number;
    unpaidFines: number;
  }> {
    const userObjectId = new Types.ObjectId(userId);

    const [stats] = await this.ticketModel
      .aggregate([
        { $match: { userId: userObjectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: {
                $cond: [{ $eq: ['$status', TicketStatus.PENDING] }, 1, 0],
              },
            },
            paid: {
              $sum: { $cond: [{ $eq: ['$status', TicketStatus.PAID] }, 1, 0] },
            },
            overdue: {
              $sum: {
                $cond: [{ $eq: ['$status', TicketStatus.OVERDUE] }, 1, 0],
              },
            },
            totalFines: { $sum: '$fineAmount' },
            unpaidFines: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [TicketStatus.PENDING, TicketStatus.OVERDUE],
                    ],
                  },
                  '$fineAmount',
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();

    return (
      stats || {
        total: 0,
        pending: 0,
        paid: 0,
        overdue: 0,
        totalFines: 0,
        unpaidFines: 0,
      }
    );
  }

  /**
   * Get or generate QR code for an existing ticket
   */
  async getQrCode(id: string): Promise<{
    token: string;
    qrCodeDataUrl: string;
    qrCodeContent: string;
    expiresAt: Date;
  }> {
    // Verify ticket exists
    await this.findOne(id);

    // Generate or get existing token
    return this.ticketTokensService.generateTokenForTicket(id);
  }

  /**
   * Get QR code as image buffer for printing
   */
  async getQrCodeImage(
    id: string,
    size?: number,
  ): Promise<{
    buffer: Buffer;
    content: string;
  }> {
    // Verify ticket exists
    await this.findOne(id);

    // Ensure token exists first
    await this.ticketTokensService.generateTokenForTicket(id);

    // Get buffer
    return this.ticketTokensService.getQrCodeBuffer(id, size);
  }
}
