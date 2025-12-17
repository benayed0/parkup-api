import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  Min,
} from 'class-validator';
import { TicketReason } from '../schemas/ticket.schema';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  meterId: string;

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
