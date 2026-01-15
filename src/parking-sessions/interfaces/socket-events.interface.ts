/**
 * Socket.IO event interfaces for parking sessions real-time updates
 */

// Client to Server Events

export interface JoinZonePayload {
  zoneId: string;
}

export interface LeaveZonePayload {
  zoneId: string;
}

export interface SwitchZonePayload {
  fromZoneId?: string;
  toZoneId: string;
}

// Server to Client Events

export interface ParkingSessionPayload {
  id: string;
  userId?: string;
  zoneId: string;
  zoneName: string;
  licensePlate: string;
  plate?: {
    type: string;
    left?: string;
    right?: string;
    formatted?: string;
  };
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  durationMinutes: number;
  amount: number;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
}

export interface ExpiringSessionPayload {
  session: ParkingSessionPayload;
  minutesRemaining: number;
  warningLevel: 'warning' | 'critical'; // warning = 10min, critical = 5min
}

export interface SessionEndedPayload {
  sessionId: string;
  zoneId: string;
  reason: 'completed' | 'cancelled' | 'expired';
}

export interface ZoneSnapshotPayload {
  zoneId: string;
  sessions: ParkingSessionPayload[];
  timestamp: string; // ISO date string
}

export interface ConnectionStatusPayload {
  status: 'connected' | 'reconnected';
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// Event name constants
export const SocketEvents = {
  // Client to Server
  ZONE_JOIN: 'zone:join',
  ZONE_LEAVE: 'zone:leave',
  ZONE_SWITCH: 'zone:switch',

  // Server to Client
  SESSION_CREATED: 'session:created',
  SESSION_UPDATED: 'session:updated',
  SESSION_EXPIRING: 'session:expiring',
  SESSION_ENDED: 'session:ended',
  ZONE_SNAPSHOT: 'zone:snapshot',
  CONNECTION_STATUS: 'connection:status',
  ERROR: 'error',
} as const;
