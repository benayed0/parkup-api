import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StreetsService } from './streets.service';
import { StreetsController } from './streets.controller';
import { Street, StreetSchema } from './schemas/street.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Street.name, schema: StreetSchema }]),
  ],
  controllers: [StreetsController],
  providers: [StreetsService],
  exports: [StreetsService],
})
export class StreetsModule {}
