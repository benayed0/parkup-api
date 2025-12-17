import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { CreateTicketDto } from './create-ticket.dto';
import { TicketStatus } from '../schemas/ticket.schema';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencePhotos?: string[];
}
