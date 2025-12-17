import {
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { ParkingSessionStatus } from '../schemas/parking-session.schema';

export class UpdateParkingSessionDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(ParkingSessionStatus)
  status?: ParkingSessionStatus;
}

export class ExtendParkingSessionDto {
  @IsNumber()
  @IsPositive()
  additionalMinutes: number;

  @IsNumber()
  @Min(0)
  additionalAmount: number;
}
