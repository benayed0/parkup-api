import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { ParkingSessionStatus } from '../schemas/parking-session.schema';

export class CreateParkingSessionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  meterId: string;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsNumber()
  @IsPositive()
  durationMinutes: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsEnum(ParkingSessionStatus)
  status?: ParkingSessionStatus;
}
