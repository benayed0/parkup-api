import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ParkingSession,
  ParkingSessionDocument,
  ParkingSessionStatus,
} from './schemas/parking-session.schema';
import { ParkingSessionsGateway } from './parking-sessions.gateway';

@Injectable()
export class ParkingSessionsScheduler {
  private readonly logger = new Logger(ParkingSessionsScheduler.name);

  // Track which sessions have already received warnings to avoid duplicates
  private warnedSessions = new Map<string, Set<number>>(); // sessionId -> Set of minutesRemaining that were warned

  constructor(
    @InjectModel(ParkingSession.name)
    private parkingSessionModel: Model<ParkingSessionDocument>,
    private readonly gateway: ParkingSessionsGateway,
  ) {}

  /**
   * Check for expiring sessions every minute
   * Emits warnings at 10 minutes and 5 minutes before expiration
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkExpiringSessions() {
    const now = new Date();

    try {
      // Find active sessions expiring in the next 10 minutes
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      const expiringSessions = await this.parkingSessionModel
        .find({
          status: ParkingSessionStatus.ACTIVE,
          endTime: {
            $gt: now,
            $lte: tenMinutesFromNow,
          },
        })
        .exec();

      for (const session of expiringSessions) {
        const minutesRemaining = Math.floor(
          (session.endTime.getTime() - now.getTime()) / 60000,
        );

        // Determine warning threshold
        let shouldWarn = false;
        let warningMinutes = 0;

        if (minutesRemaining <= 5 && minutesRemaining > 0) {
          warningMinutes = 5;
          shouldWarn = !this.hasBeenWarned(session._id.toString(), 5);
        } else if (minutesRemaining <= 10 && minutesRemaining > 5) {
          warningMinutes = 10;
          shouldWarn = !this.hasBeenWarned(session._id.toString(), 10);
        }

        if (shouldWarn) {
          this.gateway.emitExpiringWarning(session, minutesRemaining);
          this.markAsWarned(session._id.toString(), warningMinutes);
          this.logger.debug(
            `Emitted expiring warning for session ${session._id} (${minutesRemaining} min remaining)`,
          );
        }
      }

      // Clean up old warned sessions (those that have expired)
      this.cleanupWarnedSessions();
    } catch (error) {
      this.logger.error(`Error checking expiring sessions: ${error.message}`);
    }
  }

  /**
   * Update expired sessions every minute
   * Marks ACTIVE sessions past their endTime as EXPIRED
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async updateExpiredSessions() {
    const now = new Date();

    try {
      // Find sessions that should have expired
      const expiredSessions = await this.parkingSessionModel
        .find({
          status: ParkingSessionStatus.ACTIVE,
          endTime: { $lt: now },
        })
        .exec();

      for (const session of expiredSessions) {
        // Update status to expired
        await this.parkingSessionModel
          .findByIdAndUpdate(session._id, {
            status: ParkingSessionStatus.EXPIRED,
          })
          .exec();

        // Emit session ended event
        this.gateway.emitSessionEnded(session, 'expired');

        this.logger.log(
          `Session ${session._id} expired (plate: ${session.licensePlate})`,
        );
      }

      if (expiredSessions.length > 0) {
        this.logger.log(`Expired ${expiredSessions.length} sessions`);
      }
    } catch (error) {
      this.logger.error(`Error updating expired sessions: ${error.message}`);
    }
  }

  /**
   * Check if a session has already received a warning at a specific threshold
   */
  private hasBeenWarned(sessionId: string, minutes: number): boolean {
    const warnings = this.warnedSessions.get(sessionId);
    return warnings?.has(minutes) || false;
  }

  /**
   * Mark a session as having received a warning
   */
  private markAsWarned(sessionId: string, minutes: number) {
    if (!this.warnedSessions.has(sessionId)) {
      this.warnedSessions.set(sessionId, new Set());
    }
    this.warnedSessions.get(sessionId)!.add(minutes);
  }

  /**
   * Clean up tracked warnings for sessions that no longer exist or are not active
   */
  private async cleanupWarnedSessions() {
    const sessionIds = Array.from(this.warnedSessions.keys());

    if (sessionIds.length === 0) return;

    try {
      // Find which sessions are still active
      const activeSessions = await this.parkingSessionModel
        .find({
          _id: { $in: sessionIds },
          status: ParkingSessionStatus.ACTIVE,
        })
        .select('_id')
        .exec();

      const activeIds = new Set(activeSessions.map((s) => s._id.toString()));

      // Remove entries for sessions that are no longer active
      for (const sessionId of sessionIds) {
        if (!activeIds.has(sessionId)) {
          this.warnedSessions.delete(sessionId);
        }
      }
    } catch (error) {
      this.logger.error(`Error cleaning up warned sessions: ${error.message}`);
    }
  }
}
