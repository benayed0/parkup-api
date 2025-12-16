import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, lowercase: true, index: true })
  email: string;

  @Prop({ required: true })
  code: string;

  @Prop({ default: 0 })
  attempts: number;

  createdAt?: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// TTL index - auto-delete after 15 minutes (900 seconds)
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });
