import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParkingSessionsController } from './parking-sessions.controller';
import { ParkingSessionsService } from './parking-sessions.service';
import { ParkingSessionsGateway } from './parking-sessions.gateway';
import { ParkingSessionsScheduler } from './parking-sessions.scheduler';
import {
  ParkingSession,
  ParkingSessionSchema,
} from './schemas/parking-session.schema';
import {
  ParkingZone,
  ParkingZoneSchema,
} from '../parking-zones/schemas/parking-zone.schema';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParkingSession.name, schema: ParkingSessionSchema },
      { name: ParkingZone.name, schema: ParkingZoneSchema },
    ]),
    forwardRef(() => TicketsModule),
  ],
  controllers: [ParkingSessionsController],
  providers: [
    ParkingSessionsService,
    ParkingSessionsGateway,
    ParkingSessionsScheduler,
  ],
  exports: [ParkingSessionsService, ParkingSessionsGateway],
})
export class ParkingSessionsModule {}
