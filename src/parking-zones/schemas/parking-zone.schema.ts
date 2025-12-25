import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ParkingZoneDocument = ParkingZone & Document;

@Schema({ timestamps: true })
export class ParkingZone {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true, unique: true })
  name: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  @Prop({ required: true, type: Array<number[]> })
  boundaries: number[][]; // Array of [longitude, latitude] pairs
  @Prop({ required: true })
  hourlyRate: number;
  @Prop({ required: true })
  operatingHours: string;
  @Prop({ required: true, type: Object })
  prices: { car_sabot: number; pound: number };

  @Prop({ required: true, default: 0 })
  numberOfPlaces: number;

  @Prop()
  description?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ParkingZoneSchema = SchemaFactory.createForClass(ParkingZone);
