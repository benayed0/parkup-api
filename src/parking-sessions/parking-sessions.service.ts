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
import { TicketsService } from '../tickets/tickets.service';
import {
  ParkingZone,
  ParkingZoneDocument,
} from '../parking-zones/schemas/parking-zone.schema';
import { isPointInPolygon } from '../shared/geo-utils';

@Injectable()
export class ParkingSessionsService {
  constructor(
    @InjectModel(ParkingSession.name)
    private parkingSessionModel: Model<ParkingSessionDocument>,
    @InjectModel(ParkingZone.name)
    private parkingZoneModel: Model<ParkingZoneDocument>,
    @Inject(forwardRef(() => ParkingSessionsGateway))
    private readonly gateway: ParkingSessionsGateway,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
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

    // Fetch zone to validate coordinates against boundaries
    const zone = await this.parkingZoneModel.findById(createDto.zoneId).lean();

    // Validate coordinates against zone boundaries
    let locationWithinZone = false;
    if (zone?.boundaries && createDto.coordinates) {
      locationWithinZone = isPointInPolygon(
        createDto.coordinates as [number, number],
        zone.boundaries,
      );
    }

    // Set locationSource from DTO (client sends this)
    const locationSource = createDto.locationSource || 'unknown';

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
      locationSource,
      locationWithinZone,
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

  /**
   * Get enforcement data for agents
   * Returns expired sessions (violations) and soon-to-expire sessions
   * By default, excludes expired sessions that already have tickets
   * Includes location confidence data and zone boundaries
   */
  async getEnforcementData(options: {
    zoneId?: string;
    expiringThresholdMinutes?: number;
    limit?: number;
    includeTicketed?: boolean;
  }) {
    const now = new Date();
    const thresholdMinutes = options.expiringThresholdMinutes || 15;
    const thresholdTime = new Date(
      now.getTime() + thresholdMinutes * 60 * 1000,
    );
    const limit = options.limit || 50;

    // Build base query for zone filtering
    const baseQuery: Record<string, any> = {};
    if (options.zoneId) {
      baseQuery.zoneId = new Types.ObjectId(options.zoneId);
    }

    // Get expired sessions (status = EXPIRED)
    const expiredSessions = await this.parkingSessionModel
      .find({ ...baseQuery, status: ParkingSessionStatus.EXPIRED })
      .sort({ endTime: 1 }) // Oldest first (most overdue)
      .limit(limit)
      .lean()
      .exec();

    // Get soon-to-expire sessions (status = ACTIVE, endTime within threshold)
    const expiringSoonSessions = await this.parkingSessionModel
      .find({
        ...baseQuery,
        status: ParkingSessionStatus.ACTIVE,
        endTime: { $gt: now, $lte: thresholdTime },
      })
      .sort({ endTime: 1 }) // Soonest expiring first
      .limit(limit)
      .lean()
      .exec();

    // Fetch zone boundaries for all unique zones
    const allSessions = [...expiredSessions, ...expiringSoonSessions];
    const zoneIds = [
      ...new Set(allSessions.map((s) => s.zoneId.toString())),
    ];
    const zones = await this.parkingZoneModel
      .find({ _id: { $in: zoneIds } })
      .lean();
    const zoneMap = new Map(zones.map((z) => [z._id.toString(), z]));

    // Check which expired sessions already have tickets (by plate.formatted)
    const expired = await Promise.all(
      expiredSessions.map(async (session) => {
        // Use plate.formatted to find tickets (more reliable than session ID)
        const formattedPlate = session.plate?.formatted || session.licensePlate;
        const hasTicket = await this.ticketsService.hasUnpaidTickets(
          formattedPlate,
        );
        const zone = zoneMap.get(session.zoneId.toString());
        return {
          id: session._id.toString(),
          licensePlate: session.licensePlate,
          plate: session.plate,
          location: session.location,
          zoneName: session.zoneName,
          zoneId: session.zoneId.toString(),
          endTime: session.endTime,
          category: 'expired' as const,
          minutesOverdue: Math.floor(
            (now.getTime() - new Date(session.endTime).getTime()) / 60000,
          ),
          hasTicket,
          // Location confidence fields
          locationSource: (session as any).locationSource || 'unknown',
          locationWithinZone: (session as any).locationWithinZone || false,
          zoneBoundaries: zone?.boundaries || null,
          zoneLocation: zone?.location || null,
        };
      }),
    );

    // Map expiring soon sessions
    const expiringSoon = expiringSoonSessions.map((session) => {
      const zone = zoneMap.get(session.zoneId.toString());
      return {
        id: session._id.toString(),
        licensePlate: session.licensePlate,
        plate: session.plate,
        location: session.location,
        zoneName: session.zoneName,
        zoneId: session.zoneId.toString(),
        endTime: session.endTime,
        category: 'expiring_soon' as const,
        minutesRemaining: Math.floor(
          (new Date(session.endTime).getTime() - now.getTime()) / 60000,
        ),
        // Location confidence fields
        locationSource: (session as any).locationSource || 'unknown',
        locationWithinZone: (session as any).locationWithinZone || false,
        zoneBoundaries: zone?.boundaries || null,
        zoneLocation: zone?.location || null,
      };
    });

    // Filter out ticketed sessions by default (unless includeTicketed is true)
    const filteredExpired = options.includeTicketed
      ? expired
      : expired.filter((s) => !s.hasTicket);

    return {
      expired: filteredExpired,
      expiringSoon,
      summary: {
        totalExpired: filteredExpired.length,
        totalExpiringSoon: expiringSoon.length,
        expiredWithoutTicket: filteredExpired.filter((s) => !s.hasTicket).length,
      },
    };
  }
}
