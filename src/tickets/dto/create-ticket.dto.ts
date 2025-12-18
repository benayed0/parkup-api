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
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TicketReason } from '../schemas/ticket.schema';

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
  licensePlate: string;

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
