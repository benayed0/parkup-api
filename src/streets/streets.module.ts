import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StreetsService } from './streets.service';
import { StreetsController } from './streets.controller';
import { Street, StreetSchema } from './schemas/street.schema';
import { OperatorsModule } from '../operators/operators.module';
import { MapMatchingService } from './map-matching.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Street.name, schema: StreetSchema }]),
    OperatorsModule,
  ],
  controllers: [StreetsController],
  providers: [StreetsService, MapMatchingService],
  exports: [StreetsService],
})
export class StreetsModule {}
