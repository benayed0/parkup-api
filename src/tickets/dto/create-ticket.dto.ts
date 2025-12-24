import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  Min,
  ValidateNested,
  ValidateIf,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TicketReason } from '../schemas/ticket.schema';
import { PlateInputDto } from '../../users/dto/add-vehicle.dto';

// DTO for GeoJSON Point position
export class PositionDto {
  @IsString()
  @IsIn(['Point'])
  type: string = 'Point';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: number[]; // [longitude, latitude]
}

export class CreateTicketDto {
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  parkingSessionId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsString()
  @IsNotEmpty()
  parkingZoneId: string;

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

  @IsEnum(TicketReason)
  reason: TicketReason;

  @IsNumber()
  @Min(0)
  fineAmount: number;

  @IsDateString()
  issuedAt: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencePhotos?: string[];
}
