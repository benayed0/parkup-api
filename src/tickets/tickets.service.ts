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
   * Format: 6 alphanumeric characters (e.g., A7K3M2)
   * Uses safe character set excluding confusing chars (0/O, 1/I/L)
   */
  private async generateTicketNumber(maxRetries = 5): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const code = generateUniqueCode();
      const exists = await this.ticketModel.exists({ ticketNumber: code });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique ticket number after maximum retries');
  }

  /**
   * Create a new ticket
   */
  async create(createDto: CreateTicketDto): Promise<TicketDocument> {
    const ticketNumber = await this.generateTicketNumber();

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
   * Find unpaid tickets for a license plate (searches by plate.formatted)
   */
  async findUnpaidByLicensePlate(
    formattedPlate: string,
  ): Promise<TicketDocument[]> {
    const normalizedPlate = formattedPlate.toUpperCase().replace(/\s+/g, ' ').trim();

    // Search by plate.formatted (preferred) OR legacy licensePlate field
    return this.ticketModel
      .find({
        $or: [
          { 'plate.formatted': normalizedPlate },
          { licensePlate: normalizedPlate },
        ],
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
   * Check if a license plate has any unpaid tickets
   * Returns true if there are pending/overdue tickets for this plate
   */
  async hasUnpaidTickets(licensePlate: string): Promise<boolean> {
    const tickets = await this.findUnpaidByLicensePlate(licensePlate);
    return tickets.length > 0;
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
      .populate('parkingZoneId', 'name address phoneNumber')
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }
    return ticket;
  }

  /**
   * Find a ticket by ticket number (6-char code for manual entry)
   */
  async findByTicketNumber(ticketNumber: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findOne({ ticketNumber: ticketNumber.toUpperCase() })
      .populate('parkingSessionId')
      .populate('agentId')
      .populate('parkingZoneId', 'name address phoneNumber')
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketNumber} not found`);
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

  /**
   * Get print-ready ticket data with structured lines and QR code
   * Optimized to return only essential data for printing
   */
  async getPrintData(id: string): Promise<{
    lines: Array<{ label: string; value: string; type: string }>;
    qrCode: {
      dataUrl: string;
      buffer: string;
      content: string;
    };
    ticketId: string;
    ticketNumber: string;
  }> {
    // Fetch ticket with only required fields and populated references
    const ticket = await this.ticketModel
      .findById(id)
      .select(
        'ticketNumber licensePlate reason fineAmount status issuedAt dueDate position parkingZoneId agentId',
      )
      .populate('parkingZoneId', 'name address phoneNumber')
      .populate('agentId', 'name username')
      .lean()
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }

    // Get QR code data
    const qrData = await this.ticketTokensService.generateTokenForTicket(id);
    const qrBuffer = await this.ticketTokensService.getQrCodeBuffer(id);

    // Extract populated data
    const zone = ticket.parkingZoneId as any;
    const agent = ticket.agentId as any;

    // Format date helper
    const formatDate = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const formatDateOnly = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Get reason label
    const reasonLabels: Record<string, string> = {
      car_sabot: 'Car Sabot',
      pound: 'Pound',
    };

    // Get status label
    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      paid: 'Paid',
      appealed: 'Appealed',
      sabot_removed: 'Sabot Removed',
      dismissed: 'Dismissed',
      overdue: 'Overdue',
    };

    // Format coordinates
    const coords = ticket.position?.coordinates || [];
    const lat = coords[1]?.toFixed(6) || '';
    const lng = coords[0]?.toFixed(6) || '';

    // Build structured lines
    const lines: Array<{ label: string; value: string; type: string }> = [
      { label: 'Ticket Number', value: ticket.ticketNumber, type: 'header' },
      { label: 'License Plate', value: ticket.licensePlate, type: 'plate' },
      {
        label: 'Reason',
        value: reasonLabels[ticket.reason] || ticket.reason,
        type: 'text',
      },
      {
        label: 'Fine Amount',
        value: `${ticket.fineAmount.toFixed(2)} TND`,
        type: 'amount',
      },
      { label: 'Issued At', value: formatDate(ticket.issuedAt), type: 'date' },
      { label: 'Due Date', value: formatDateOnly(ticket.dueDate), type: 'date' },
      {
        label: 'Status',
        value: statusLabels[ticket.status] || ticket.status,
        type: 'status',
      },
    ];

    // Add zone info if populated (check for name property to confirm it's populated)
    if (zone && zone.name) {
      lines.push({ label: 'Zone', value: zone.name, type: 'text' });
      if (zone.address) {
        lines.push({ label: 'Address', value: zone.address, type: 'text' });
      }
      if (zone.phoneNumber) {
        lines.push({ label: 'Phone', value: zone.phoneNumber, type: 'phone' });
      }
    }

    // Add agent info if populated (check for name property to confirm it's populated)
    if (agent && agent.name) {
      const agentName = agent.name;
      const agentCode = agent.username || '';
      lines.push({
        label: 'Agent',
        value: agentCode ? `${agentName} (${agentCode})` : agentName,
        type: 'text',
      });
    }

    // Add location coordinates
    if (lat && lng) {
      lines.push({ label: 'Location', value: `${lat}, ${lng}`, type: 'coordinates' });
    }

    // Add payment instructions
    lines.push({
      label: 'Payment Info',
      value: 'Pay online or at any authorized office before the due date',
      type: 'footer',
    });

    return {
      lines,
      qrCode: {
        dataUrl: qrData.qrCodeDataUrl,
        buffer: qrBuffer.buffer.toString('base64'),
        content: qrData.qrCodeContent,
      },
      ticketId: (ticket._id as any).toString(),
      ticketNumber: ticket.ticketNumber,
    };
  }
}
