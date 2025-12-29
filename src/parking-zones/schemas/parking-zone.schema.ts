import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SeasonalPeriod } from '../interfaces/seasonal-hours.interface';

export type ParkingZoneDocument = ParkingZone & Document;

@Schema({ _id: false })
export class SeasonalPeriodSchema {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1, max: 12 })
  startMonth: number;

  @Prop({ required: true, min: 1, max: 31 })
  startDay: number;

  @Prop({ required: true, min: 1, max: 12 })
  endMonth: number;

  @Prop({ required: true, min: 1, max: 31 })
  endDay: number;

  @Prop({ required: true, default: false })
  is24h: boolean;

  @Prop()
  hoursFrom?: string;

  @Prop()
  hoursTo?: string;
}

export const SeasonalPeriodMongoSchema =
  SchemaFactory.createForClass(SeasonalPeriodSchema);

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

  @Prop({ type: [SeasonalPeriodMongoSchema], default: [] })
  seasonalOperatingHours: SeasonalPeriod[];

  @Prop({ required: true, type: Object })
  prices: { car_sabot: number; pound: number };

  @Prop({ required: true, default: 0 })
  numberOfPlaces: number;

  @Prop({ type: String, required: true })
  address: string;
  @Prop({ type: String, required: true })
  phoneNumber: string;
  @Prop()
  description?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ParkingZoneSchema = SchemaFactory.createForClass(ParkingZone);
