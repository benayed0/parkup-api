import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '../schemas/ticket.schema';

export class PayTicketDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
