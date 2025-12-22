import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParkingSessionStatus } from '../schemas/parking-session.schema';
import { PlateInputDto } from '../../users/dto/add-vehicle.dto';

export class CreateParkingSessionDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  zoneId: string;

  @IsString()
  @IsNotEmpty()
  zoneName: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number]; // [longitude, latitude]

  /**
   * Structured license plate (preferred)
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PlateInputDto)
  plate?: PlateInputDto;

  /**
   * @deprecated Use plate instead
   * Legacy string format for backward compatibility
   */
  @ValidateIf((o) => !o.plate)
  @IsString()
  @IsNotEmpty()
  licensePlate?: string;

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
