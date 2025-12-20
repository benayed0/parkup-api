import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StreetDocument = Street & Document;

export enum StreetType {
  FREE = 'FREE',
  PAYABLE = 'PAYABLE',
  PROHIBITED = 'PROHIBITED',
}

@Schema({ timestamps: true })
export class Street {
  @Prop({
    type: Types.ObjectId,
    ref: 'ParkingZone',
    required: true,
    index: true,
  })
  zoneId: Types.ObjectId;

  @Prop({ required: true, enum: StreetType, index: true })
  type: StreetType;

  @Prop({ required: true })
  encodedPolyline: string;

  @Prop({ default: true, index: true })
  isActive?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StreetSchema = SchemaFactory.createForClass(Street);

// Compound index for common queries
StreetSchema.index({ zoneId: 1, isActive: 1 });
StreetSchema.index({ zoneId: 1, type: 1 });
