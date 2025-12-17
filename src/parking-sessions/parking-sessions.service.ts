import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ParkingSession,
  ParkingSessionDocument,
  ParkingSessionStatus,
} from './schemas/parking-session.schema';
import {
  CreateParkingSessionDto,
  UpdateParkingSessionDto,
  ExtendParkingSessionDto,
} from './dto';

@Injectable()
export class ParkingSessionsService {
  constructor(
    @InjectModel(ParkingSession.name)
    private parkingSessionModel: Model<ParkingSessionDocument>,
  ) {}

  /**
   * Create a new parking session
   */
  async create(
    createDto: CreateParkingSessionDto,
  ): Promise<ParkingSessionDocument> {
    const session = new this.parkingSessionModel({
      ...createDto,
      meterId: new Types.ObjectId(createDto.meterId),
      licensePlate: createDto.licensePlate.toUpperCase().replace(/\s/g, ''),
      status: createDto.status || ParkingSessionStatus.ACTIVE,
    });

    return session.save();
  }

  /**
   * Find all sessions with optional filters
   */
  async findAll(filters?: {
    userId?: string;
    status?: ParkingSessionStatus;
    licensePlate?: string;
    limit?: number;
    skip?: number;
  }): Promise<ParkingSessionDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.userId) {
      query.userId = filters.userId;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.licensePlate) {
      query.licensePlate = filters.licensePlate.toUpperCase().replace(/\s/g, '');
    }

    return this.parkingSessionModel
      .find(query)
      .populate('meterId')
      .sort({ createdAt: -1 })
      .skip(filters?.skip || 0)
      .limit(filters?.limit || 50)
      .exec();
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    options?: { status?: ParkingSessionStatus; limit?: number },
  ): Promise<ParkingSessionDocument[]> {
    return this.findAll({
      userId,
      status: options?.status,
      limit: options?.limit,
    });
  }

  /**
   * Find active session for a user
   */
  async findActiveByUserId(userId: string): Promise<ParkingSessionDocument | null> {
    return this.parkingSessionModel
      .findOne({
        userId,
        status: ParkingSessionStatus.ACTIVE,
      })
      .populate('meterId')
      .exec();
  }

  /**
   * Find active sessions for a license plate
   */
  async findActiveByLicensePlate(
    licensePlate: string,
  ): Promise<ParkingSessionDocument[]> {
    return this.parkingSessionModel
      .find({
        licensePlate: licensePlate.toUpperCase().replace(/\s/g, ''),
        status: ParkingSessionStatus.ACTIVE,
      })
      .populate('meterId')
      .exec();
  }

  /**
   * Find a single session by ID (with populated meter)
   */
  async findOne(id: string): Promise<ParkingSessionDocument> {
    const session = await this.parkingSessionModel
      .findById(id)
      .populate('meterId')
      .exec();
    if (!session) {
      throw new NotFoundException(`Parking session #${id} not found`);
    }
    return session;
  }

  /**
   * Update a parking session
   */
  async update(
    id: string,
    updateDto: UpdateParkingSessionDto,
  ): Promise<ParkingSessionDocument> {
    const session = await this.parkingSessionModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();

    if (!session) {
      throw new NotFoundException(`Parking session #${id} not found`);
    }

    return session;
  }

  /**
   * Extend a parking session
   */
  async extend(
    id: string,
    extendDto: ExtendParkingSessionDto,
  ): Promise<ParkingSessionDocument> {
    const session = await this.findOne(id);

    if (session.status !== ParkingSessionStatus.ACTIVE) {
      throw new BadRequestException('Can only extend active sessions');
    }

    const newEndTime = new Date(session.endTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + extendDto.additionalMinutes);

    const updatedSession = await this.parkingSessionModel
      .findByIdAndUpdate(
        id,
        {
          endTime: newEndTime,
          durationMinutes: session.durationMinutes + extendDto.additionalMinutes,
          amount: session.amount + extendDto.additionalAmount,
        },
        { new: true },
      )
      .exec();

    return updatedSession!;
  }

  /**
   * End a parking session
   */
  async end(id: string): Promise<ParkingSessionDocument> {
    const session = await this.findOne(id);

    if (session.status !== ParkingSessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }

    return this.update(id, { status: ParkingSessionStatus.COMPLETED });
  }

  /**
   * Cancel a parking session
   */
  async cancel(id: string): Promise<ParkingSessionDocument> {
    const session = await this.findOne(id);

    if (session.status !== ParkingSessionStatus.ACTIVE) {
      throw new BadRequestException('Can only cancel active sessions');
    }

    return this.update(id, { status: ParkingSessionStatus.CANCELLED });
  }

  /**
   * Delete a parking session (soft delete by marking as cancelled or hard delete)
   */
  async remove(id: string): Promise<void> {
    const result = await this.parkingSessionModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Parking session #${id} not found`);
    }
  }

  /**
   * Check and update expired sessions (can be called by a cron job)
   * Uses UTC for consistent timezone handling
   */
  async updateExpiredSessions(): Promise<number> {
    const nowUtc = new Date();
    const result = await this.parkingSessionModel
      .updateMany(
        {
          status: ParkingSessionStatus.ACTIVE,
          endTime: { $lt: nowUtc },
        },
        { status: ParkingSessionStatus.EXPIRED },
      )
      .exec();

    return result.modifiedCount;
  }

  /**
   * Get user's parking history
   */
  async getHistory(
    userId: string,
    limit = 20,
    skip = 0,
  ): Promise<ParkingSessionDocument[]> {
    return this.parkingSessionModel
      .find({
        userId,
        status: { $in: [ParkingSessionStatus.COMPLETED, ParkingSessionStatus.EXPIRED, ParkingSessionStatus.CANCELLED] },
      })
      .populate('meterId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }
}
