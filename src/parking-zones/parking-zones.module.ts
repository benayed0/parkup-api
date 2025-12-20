import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParkingZonesController } from './parking-zones.controller';
import { ParkingZonesService } from './parking-zones.service';
import { ParkingZone, ParkingZoneSchema } from './schemas/parking-zone.schema';
import { OperatorsModule } from '../operators/operators.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParkingZone.name, schema: ParkingZoneSchema },
    ]),
    OperatorsModule,
  ],
  controllers: [ParkingZonesController],
  providers: [ParkingZonesService],
  exports: [ParkingZonesService],
})
export class ParkingZonesModule {}
