import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransactionReason } from '../schemas/wallet-transaction.schema';

export class PayWalletDto {
  @IsNumber()
  @Min(1, { message: 'Amount must be at least 1 (minor unit)' })
  amount: number;

  @IsEnum(TransactionReason, {
    message: 'Reason must be one of: PARKING_PAYMENT, REFUND, ADJUSTMENT',
  })
  @IsOptional()
  reason?: TransactionReason;

  @IsString()
  @IsOptional()
  referenceId?: string;
}
