import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TopupWalletDto {
  @IsNumber()
  @Min(1, { message: 'Amount must be at least 1 (minor unit)' })
  amount: number;

  @IsString()
  @IsOptional()
  referenceId?: string;
}
