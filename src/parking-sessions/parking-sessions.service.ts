import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ParkingSessionsGateway } from './parking-sessions.gateway';
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
import {
  createLicensePlate,
  parseLicensePlateString,
  normalizeLicensePlate,
} from '../shared/license-plate';

@Injectable()
export class ParkingSessionsService {
  constructor(
    @InjectModel(ParkingSession.name)
    private parkingSessionModel: Model<ParkingSessionDocument>,
    @Inject(forwardRef(() => ParkingSessionsGateway))
    private readonly gateway: ParkingSessionsGateway,
  ) {}

  /**
   * Create a new parking session
   */
  async create(
    createDto: CreateParkingSessionDto,
  ): Promise<ParkingSessionDocument> {
    const userId = createDto.userId
      ? Types.ObjectId.isValid(createDto.userId)
        ? new Types.ObjectId(createDto.userId)
        : undefined
      : undefined;

    // Resolve license plate from structured or string format
    const plate = createDto.plate
      ? createLicensePlate(
          createDto.plate.type,
          createDto.plate.left,
          createDto.plate.right,
        )
      : parseLicensePlateString(createDto.licensePlate || '');

    const session = new this.parkingSessionModel({
      userId,
      zoneId: new Types.ObjectId(createDto.zoneId),
      zoneName: createDto.zoneName,
      location: {
        type: 'Point',
        coordinates: createDto.coordinates,
      },
      plate: plate,
      licensePlate: plate.formatted, // Keep for backward compatibility
      startTime: createDto.startTime,
      endTime: createDto.endTime,
      durationMinutes: createDto.durationMinutes,
      amount: createDto.amount,
      status: createDto.status || ParkingSessionStatus.ACTIVE,
    });

    const savedSession = await session.save();

    // Emit real-time event for new session
    if (savedSession.status === ParkingSessionStatus.ACTIVE) {
      this.gateway.emitSessionCreated(savedSession);
    }

    return savedSession;
  }

  /**
   * Find all sessions with optional filters
   */
  async findAll(filters?: {
    userId?: string;
    zoneId?: string;
    status?: ParkingSessionStatus;
    licensePlate?: string;
    limit?: number;
    skip?: number;
  }): Promise<ParkingSessionDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }
    if (filters?.zoneId) {
      query.zoneId = new Types.ObjectId(filters.zoneId);
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.licensePlate) {
      query.licensePlate = normalizeLicensePlate(filters.licensePlate);
    }

    return this.parkingSessionModel
      .find(query)
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
  async findActiveByUserId(
    userId: string,
  ): Promise<ParkingSessionDocument | null> {
    return this.parkingSessionModel
      .findOne({
        userId,
        status: ParkingSessionStatus.ACTIVE,
      })
      .exec();
  }

  /**
   * Find active sessions by structured plate data
   * Uses $or query to match both structured fields AND legacy formatted string
   * This is more efficient than separate queries
   */
  async findActiveByPlate(
    plate: {
      type: string;
      left?: string;
      right?: string;
      formatted?: string;
    },
    zoneId?: string,
  ): Promise<ParkingSessionDocument[]> {
    const now = new Date();

    // Build structured plate query
    const structuredQuery: Record<string, any> = {};
    if (plate.type) {
      structuredQuery['plate.type'] = plate.type;
    }
    if (plate.left) {
      structuredQuery['plate.left'] = plate.left
        .toUpperCase()
        .replace(/\s/g, '');
    }
    if (plate.right) {
      structuredQuery['plate.right'] = plate.right
        .toUpperCase()
        .replace(/\s/g, '');
    }

    // Build formatted string query for legacy data
    const formattedQuery: Record<string, any> = {};
    if (plate.formatted) {
      formattedQuery.licensePlate = normalizeLicensePlate(plate.formatted);
    }

    // Use $or to search both structured and legacy in single query
    const hasStructured = Object.keys(structuredQuery).length > 0;
    const hasFormatted = Object.keys(formattedQuery).length > 0;

    const orConditions: Record<string, any>[] = [];
    if (hasStructured) {
      orConditions.push(structuredQuery);
    }
    if (hasFormatted) {
      orConditions.push(formattedQuery);
    }

    // If no valid query conditions, return empty
    if (orConditions.length === 0) {
      return [];
    }

    const query: Record<string, any> = {
      endTime: { $gt: now },
      $or: orConditions,
    };

    // Filter by zoneId if provided
    if (zoneId) {
      query.zoneId = new Types.ObjectId(zoneId);
    }

    return this.parkingSessionModel.find(query).exec();
  }

  /**
   * Find active sessions for a license plate string
   * @deprecated Use findActiveByPlate with structured plate object instead
   */
  async findActiveByLicensePlate(
    licensePlate: string,
  ): Promise<ParkingSessionDocument[]> {
    return this.parkingSessionModel
      .find({
        licensePlate: normalizeLicensePlate(licensePlate),
        endTime: { $gt: new Date() },
      })
      .exec();
  }

  /**
   * Find a single session by ID
   */
  async findOne(id: string): Promise<ParkingSessionDocument> {
    const session = await this.parkingSessionModel.findById(id).exec();
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
    const updateData: Record<string, any> = { ...updateDto };

    if (updateDto.userId && Types.ObjectId.isValid(updateDto.userId)) {
      updateData.userId = new Types.ObjectId(updateDto.userId);
    }

    if (updateDto.zoneId && Types.ObjectId.isValid(updateDto.zoneId)) {
      updateData.zoneId = new Types.ObjectId(updateDto.zoneId);
    }

    if (updateDto.coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates: updateDto.coordinates,
      };
      delete updateData.coordinates;
    }

    const session = await this.parkingSessionModel
      .findByIdAndUpdate(id, updateData, { new: true })
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
    newEndTime.setMinutes(
      newEndTime.getMinutes() + extendDto.additionalMinutes,
    );

    const updatedSession = await this.parkingSessionModel
      .findByIdAndUpdate(
        id,
        {
          endTime: newEndTime,
          durationMinutes:
            session.durationMinutes + extendDto.additionalMinutes,
          amount: session.amount + extendDto.additionalAmount,
        },
        { new: true },
      )
      .exec();

    // Emit real-time event for extended session
    if (updatedSession) {
      this.gateway.emitSessionUpdated(updatedSession);
    }

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

    const updatedSession = await this.update(id, {
      status: ParkingSessionStatus.COMPLETED,
    });

    // Emit real-time event for ended session
    this.gateway.emitSessionEnded(updatedSession, 'completed');

    return updatedSession;
  }

  /**
   * Cancel a parking session
   */
  async cancel(id: string): Promise<ParkingSessionDocument> {
    const session = await this.findOne(id);

    if (session.status !== ParkingSessionStatus.ACTIVE) {
      throw new BadRequestException('Can only cancel active sessions');
    }

    const updatedSession = await this.update(id, {
      status: ParkingSessionStatus.CANCELLED,
    });

    // Emit real-time event for cancelled session
    this.gateway.emitSessionEnded(updatedSession, 'cancelled');

    return updatedSession;
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
    const result = await this.parkingSessionModel
      .find({
        userId,
        status: {
          $in: [
            ParkingSessionStatus.COMPLETED,
            ParkingSessionStatus.EXPIRED,
            ParkingSessionStatus.CANCELLED,
          ],
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return result;
  }
}
