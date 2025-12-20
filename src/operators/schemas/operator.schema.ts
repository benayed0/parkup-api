import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OperatorDocument = Operator & Document;

export enum OperatorRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  SUPERVISOR = 'supervisor',
}

// Role hierarchy (higher number = higher privileges)
export const ROLE_HIERARCHY: Record<OperatorRole, number> = {
  [OperatorRole.SUPER_ADMIN]: 100,
  [OperatorRole.ADMIN]: 75,
  [OperatorRole.MANAGER]: 50,
  [OperatorRole.SUPERVISOR]: 25,
};

@Schema({ timestamps: true })
export class Operator {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: OperatorRole,
    default: OperatorRole.SUPERVISOR,
    index: true,
  })
  role: OperatorRole;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'ParkingZone' }],
    default: [],
  })
  zoneIds: Types.ObjectId[];

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ type: String, default: null })
  currentOtp: string | null;

  @Prop({ type: Date, default: null })
  otpExpiresAt: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OperatorSchema = SchemaFactory.createForClass(Operator);

// Indexes
OperatorSchema.index({ isActive: 1, email: 1 });
OperatorSchema.index({ zoneIds: 1 });
OperatorSchema.index({ role: 1, isActive: 1 });
