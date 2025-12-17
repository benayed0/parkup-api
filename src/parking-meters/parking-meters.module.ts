import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParkingMetersController } from './parking-meters.controller';
import { ParkingMetersService } from './parking-meters.service';
import {
  ParkingMeter,
  ParkingMeterSchema,
} from './schemas/parking-meter.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParkingMeter.name, schema: ParkingMeterSchema },
    ]),
  ],
  controllers: [ParkingMetersController],
  providers: [ParkingMetersService],
  exports: [ParkingMetersService],
})
export class ParkingMetersModule {}
