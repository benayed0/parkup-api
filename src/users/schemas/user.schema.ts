import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class Vehicle {
  @Prop({ required: true, uppercase: true })
  licensePlate: string;

  @Prop()
  nickname: string;

  @Prop({ default: false })
  isDefault: boolean;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop()
  phone: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ type: [VehicleSchema], default: [] })
  vehicles: Vehicle[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index for querying vehicles by license plate
UserSchema.index({ 'vehicles.licensePlate': 1 });
