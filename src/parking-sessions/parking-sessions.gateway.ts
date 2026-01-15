import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, forwardRef, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ParkingSessionsService } from './parking-sessions.service';
import {
  ParkingSessionDocument,
  ParkingSessionStatus,
} from './schemas/parking-session.schema';
import {
  JoinZonePayload,
  LeaveZonePayload,
  SwitchZonePayload,
  ParkingSessionPayload,
  ExpiringSessionPayload,
  SessionEndedPayload,
  ZoneSnapshotPayload,
  SocketEvents,
} from './interfaces/socket-events.interface';

@WebSocketGateway({
  namespace: '/parking-sessions',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ParkingSessionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ParkingSessionsGateway.name);

  // Track connected clients per zone for monitoring
  private zoneClients = new Map<string, Set<string>>();

  constructor(
    @Inject(forwardRef(() => ParkingSessionsService))
    private readonly parkingSessionsService: ParkingSessionsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Parking Sessions WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit(SocketEvents.CONNECTION_STATUS, { status: 'connected' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up from all zone rooms
    this.zoneClients.forEach((clients, zone) => {
      clients.delete(client.id);
    });
  }

  /**
   * Handle client joining a zone room
   */
  @SubscribeMessage(SocketEvents.ZONE_JOIN)
  async handleJoinZone(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinZonePayload,
  ) {
    const room = `zone-${payload.zoneId}`;
    client.join(room);

    // Track client in zone
    if (!this.zoneClients.has(payload.zoneId)) {
      this.zoneClients.set(payload.zoneId, new Set());
    }
    this.zoneClients.get(payload.zoneId)!.add(client.id);

    this.logger.log(`Client ${client.id} joined zone ${payload.zoneId}`);

    // Send initial snapshot of active sessions
    await this.sendZoneSnapshot(client, payload.zoneId);
  }

  /**
   * Handle client leaving a zone room
   */
  @SubscribeMessage(SocketEvents.ZONE_LEAVE)
  handleLeaveZone(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveZonePayload,
  ) {
    const room = `zone-${payload.zoneId}`;
    client.leave(room);

    // Remove client from zone tracking
    this.zoneClients.get(payload.zoneId)?.delete(client.id);

    this.logger.log(`Client ${client.id} left zone ${payload.zoneId}`);
  }

  /**
   * Handle client switching between zones
   */
  @SubscribeMessage(SocketEvents.ZONE_SWITCH)
  async handleSwitchZone(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SwitchZonePayload,
  ) {
    // Leave old zone if specified
    if (payload.fromZoneId) {
      client.leave(`zone-${payload.fromZoneId}`);
      this.zoneClients.get(payload.fromZoneId)?.delete(client.id);
      this.logger.log(`Client ${client.id} left zone ${payload.fromZoneId}`);
    }

    // Join new zone
    const room = `zone-${payload.toZoneId}`;
    client.join(room);

    if (!this.zoneClients.has(payload.toZoneId)) {
      this.zoneClients.set(payload.toZoneId, new Set());
    }
    this.zoneClients.get(payload.toZoneId)!.add(client.id);

    this.logger.log(`Client ${client.id} joined zone ${payload.toZoneId}`);

    // Send snapshot of new zone
    await this.sendZoneSnapshot(client, payload.toZoneId);
  }

  /**
   * Send current active sessions snapshot to a client
   */
  private async sendZoneSnapshot(client: Socket, zoneId: string) {
    try {
      const sessions = await this.parkingSessionsService.findAll({
        zoneId,
        status: ParkingSessionStatus.ACTIVE,
      });

      const snapshot: ZoneSnapshotPayload = {
        zoneId,
        sessions: sessions.map((s) => this.toPayload(s)),
        timestamp: new Date().toISOString(),
      };

      client.emit(SocketEvents.ZONE_SNAPSHOT, snapshot);
      this.logger.debug(
        `Sent snapshot with ${sessions.length} sessions to client ${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send zone snapshot: ${error.message}`);
      client.emit(SocketEvents.ERROR, { message: 'Failed to load sessions' });
    }
  }

  /**
   * Emit session created event to zone room
   */
  emitSessionCreated(session: ParkingSessionDocument) {
    const room = `zone-${session.zoneId.toString()}`;
    const payload = this.toPayload(session);

    this.server.to(room).emit(SocketEvents.SESSION_CREATED, payload);
    this.logger.debug(`Emitted session:created to ${room}`);
  }

  /**
   * Emit session updated event to zone room
   */
  emitSessionUpdated(session: ParkingSessionDocument) {
    const room = `zone-${session.zoneId.toString()}`;
    const payload = this.toPayload(session);

    this.server.to(room).emit(SocketEvents.SESSION_UPDATED, payload);
    this.logger.debug(`Emitted session:updated to ${room}`);
  }

  /**
   * Emit session ended event to zone room
   */
  emitSessionEnded(
    session: ParkingSessionDocument,
    reason: 'completed' | 'cancelled' | 'expired',
  ) {
    const room = `zone-${session.zoneId.toString()}`;
    const payload: SessionEndedPayload = {
      sessionId: session._id.toString(),
      zoneId: session.zoneId.toString(),
      reason,
    };

    this.server.to(room).emit(SocketEvents.SESSION_ENDED, payload);
    this.logger.debug(`Emitted session:ended (${reason}) to ${room}`);
  }

  /**
   * Emit expiring warning event to zone room
   */
  emitExpiringWarning(
    session: ParkingSessionDocument,
    minutesRemaining: number,
  ) {
    const room = `zone-${session.zoneId.toString()}`;
    const payload: ExpiringSessionPayload = {
      session: this.toPayload(session),
      minutesRemaining,
      warningLevel: minutesRemaining <= 5 ? 'critical' : 'warning',
    };

    this.server.to(room).emit(SocketEvents.SESSION_EXPIRING, payload);
    this.logger.debug(
      `Emitted session:expiring (${minutesRemaining}min) to ${room}`,
    );
  }

  /**
   * Convert document to payload
   */
  private toPayload(session: ParkingSessionDocument): ParkingSessionPayload {
    return {
      id: session._id.toString(),
      userId: session.userId?.toString(),
      zoneId: session.zoneId.toString(),
      zoneName: session.zoneName,
      licensePlate: session.licensePlate,
      plate: session.plate
        ? {
            type: session.plate.type,
            left: session.plate.left,
            right: session.plate.right,
            formatted: session.plate.formatted,
          }
        : undefined,
      location: session.location,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      durationMinutes: session.durationMinutes,
      amount: session.amount,
      status: session.status as ParkingSessionPayload['status'],
    };
  }

  /**
   * Get count of connected clients in a zone (for monitoring)
   */
  getZoneClientCount(zoneId: string): number {
    return this.zoneClients.get(zoneId)?.size || 0;
  }

  /**
   * Get total connected clients count (for monitoring)
   */
  getTotalClientCount(): number {
    let total = 0;
    this.zoneClients.forEach((clients) => {
      total += clients.size;
    });
    return total;
  }
}
