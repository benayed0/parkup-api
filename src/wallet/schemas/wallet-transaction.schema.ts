import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletTransactionDocument = WalletTransaction & Document;

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum TransactionReason {
  TOPUP = 'TOPUP',
  PARKING_PAYMENT = 'PARKING_PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ type: String, enum: TransactionReason, required: true })
  reason: TransactionReason;

  @Prop({ type: Types.ObjectId, index: true, sparse: true })
  referenceId?: Types.ObjectId;

  @Prop({ type: Number })
  balanceAfter: number;

  createdAt?: Date;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);

// Compound index for querying user transactions by date
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

// Index on referenceId for idempotency checks
WalletTransactionSchema.index({ referenceId: 1 }, { sparse: true });
