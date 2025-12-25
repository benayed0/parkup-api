import { IsMongoId, IsOptional, IsInt, Min, Max } from 'class-validator';

export class GenerateTicketTokenDto {
  @IsMongoId()
  ticketId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expirationDays?: number;
}

export class RegenerateQrCodeDto {
  @IsMongoId()
  ticketId: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1000)
  size?: number;
}
