import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema({ timestamps: true })
export class Wallet {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  balance: number;

  @Prop({ type: String, default: 'TND' })
  currency: string;

  @Prop({ type: Number, default: 0 })
  version: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// Unique index on userId (already defined in @Prop, but explicit for clarity)
WalletSchema.index({ userId: 1 }, { unique: true });
