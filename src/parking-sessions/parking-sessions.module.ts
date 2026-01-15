import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParkingSessionsController } from './parking-sessions.controller';
import { ParkingSessionsService } from './parking-sessions.service';
import { ParkingSessionsGateway } from './parking-sessions.gateway';
import { ParkingSessionsScheduler } from './parking-sessions.scheduler';
import {
  ParkingSession,
  ParkingSessionSchema,
} from './schemas/parking-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParkingSession.name, schema: ParkingSessionSchema },
    ]),
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
