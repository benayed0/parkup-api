import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ParkingMeter,
  ParkingMeterDocument,
} from './schemas/parking-meter.schema';
import { CreateParkingMeterDto, UpdateParkingMeterDto } from './dto';

@Injectable()
export class ParkingMetersService {
  constructor(
    @InjectModel(ParkingMeter.name)
    private parkingMeterModel: Model<ParkingMeterDocument>,
  ) {}

  async create(createDto: CreateParkingMeterDto): Promise<ParkingMeterDocument> {
    const meter = new this.parkingMeterModel({
      ...createDto,
      zoneId: new Types.ObjectId(createDto.zoneId),
      parkingCode: createDto.parkingCode.toUpperCase().replace(/\s/g, ''),
      location: {
        type: 'Point',
        coordinates: createDto.coordinates,
      },
    });
    return meter.save();
  }

  async findAll(filters?: {
    isActive?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<ParkingMeterDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    return this.parkingMeterModel
      .find(query)
      .sort({ parkingCode: 1 })
      .skip(filters?.skip || 0)
      .limit(filters?.limit || 100)
      .exec();
  }

  async findNearby(
    longitude: number,
    latitude: number,
    radiusMeters: number = 5000,
    limit: number = 50,
  ): Promise<ParkingMeterDocument[]> {
    return this.parkingMeterModel
      .find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusMeters,
          },
        },
        isActive: true,
      })
      .limit(limit)
      .exec();
  }

  async findByZone(zoneId: string): Promise<ParkingMeterDocument[]> {
    return this.parkingMeterModel
      .find({ zoneId: new Types.ObjectId(zoneId), isActive: true })
      .sort({ parkingCode: 1 })
      .exec();
  }

  async findOne(id: string): Promise<ParkingMeterDocument> {
    const meter = await this.parkingMeterModel.findById(id).exec();
    if (!meter) {
      throw new NotFoundException(`Parking meter #${id} not found`);
    }
    return meter;
  }

  async findByParkingCode(parkingCode: string): Promise<ParkingMeterDocument> {
    const meter = await this.parkingMeterModel
      .findOne({ parkingCode: parkingCode.toUpperCase().replace(/\s/g, '') })
      .exec();
    if (!meter) {
      throw new NotFoundException(
        `Parking meter with code ${parkingCode} not found`,
      );
    }
    return meter;
  }

  async update(
    id: string,
    updateDto: UpdateParkingMeterDto,
  ): Promise<ParkingMeterDocument> {
    const updateData: Record<string, any> = { ...updateDto };

    if (updateData.parkingCode) {
      updateData.parkingCode = updateData.parkingCode
        .toUpperCase()
        .replace(/\s/g, '');
    }

    if (updateData.zoneId) {
      updateData.zoneId = new Types.ObjectId(updateData.zoneId);
    }

    if (updateData.coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates: updateData.coordinates,
      };
      delete updateData.coordinates;
    }

    const meter = await this.parkingMeterModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!meter) {
      throw new NotFoundException(`Parking meter #${id} not found`);
    }

    return meter;
  }

  async remove(id: string): Promise<void> {
    const result = await this.parkingMeterModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Parking meter #${id} not found`);
    }
  }
}
