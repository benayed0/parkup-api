import { PartialType } from '@nestjs/mapped-types';
import { CreateParkingMeterDto } from './create-parking-meter.dto';

export class UpdateParkingMeterDto extends PartialType(CreateParkingMeterDto) {}
