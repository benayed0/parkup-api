import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ParkingMeterDocument = ParkingMeter & Document;

@Schema({ timestamps: true })
export class ParkingMeter {
  @Prop({ type: Types.ObjectId, ref: 'ParkingZone', required: true, index: true })
  zoneId: Types.ObjectId;

  @Prop({ required: true, unique: true, uppercase: true })
  parkingCode: string;

  @Prop({ required: true })
  zoneName: string;

  @Prop({ required: true, min: 0 })
  hourlyRate: number;

  @Prop({ min: 0 })
  dailyRate?: number;

  @Prop({ min: 1 })
  maxDurationMinutes?: number;

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
    type: string;
    coordinates: number[]; // [longitude, latitude]
  };

  @Prop()
  address?: string;

  @Prop({ required: true })
  operatingHours: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ParkingMeterSchema = SchemaFactory.createForClass(ParkingMeter);

// Geospatial index for location-based queries
ParkingMeterSchema.index({ location: '2dsphere' });

// Compound index for zone queries
ParkingMeterSchema.index({ zoneId: 1, isActive: 1 });
