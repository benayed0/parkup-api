import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  LicensePlate,
  LicensePlateSchema,
} from '../../shared/license-plate/license-plate.schema';

export enum BadgeStatus {
  ACTIVE = 'active',
  INVALIDATED = 'invalidated',
}

export type LicensePlateBadgeDocument = LicensePlateBadge & Document;

@Schema({ timestamps: true })
export class LicensePlateBadge {
  @Prop({ type: LicensePlateSchema })
  plate?: LicensePlate;

  @Prop({ required: true, index: true })
  licensePlate: string;

  @Prop({ type: Types.ObjectId, ref: 'ParkingZone', required: true })
  zoneId: Types.ObjectId;

  @Prop({ required: true })
  zoneName: string;

  @Prop({ required: true, index: true })
  year: number;

  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true })
  agentId: Types.ObjectId;

  @Prop({ required: true, enum: BadgeStatus, default: BadgeStatus.ACTIVE })
  status: BadgeStatus;

  @Prop()
  invalidatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Agent' })
  invalidatedByAgentId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LicensePlateBadgeSchema =
  SchemaFactory.createForClass(LicensePlateBadge);

// Compound indexes for fast lookups
LicensePlateBadgeSchema.index({ licensePlate: 1, year: 1 });
LicensePlateBadgeSchema.index({ licensePlate: 1, year: 1, status: 1 });
