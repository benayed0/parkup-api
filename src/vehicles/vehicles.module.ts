import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { ParkingSessionsModule } from '../parking-sessions/parking-sessions.module';
import { LicensePlateBadgesModule } from '../license-plate-badges/license-plate-badges.module';
import { AgentsModule } from '../agents/agents.module';
import { OperatorsModule } from '../operators/operators.module';

@Module({
  imports: [
    ParkingSessionsModule,
    LicensePlateBadgesModule,
    AgentsModule,
    OperatorsModule,
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
