import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ParkingZoneDocument = ParkingZone & Document;

@Schema({ timestamps: true })
export class ParkingZone {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ParkingZoneSchema = SchemaFactory.createForClass(ParkingZone);
