import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  token: string;

  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;

  createdAt?: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index - auto-delete after 30 days (2592000 seconds)
RefreshTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
