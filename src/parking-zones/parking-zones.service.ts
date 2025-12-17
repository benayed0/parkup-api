import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ParkingZone,
  ParkingZoneDocument,
} from './schemas/parking-zone.schema';
import { CreateParkingZoneDto, UpdateParkingZoneDto } from './dto';

@Injectable()
export class ParkingZonesService {
  constructor(
    @InjectModel(ParkingZone.name)
    private parkingZoneModel: Model<ParkingZoneDocument>,
  ) {}

  async create(createDto: CreateParkingZoneDto): Promise<ParkingZoneDocument> {
    const zone = new this.parkingZoneModel({
      ...createDto,
      code: createDto.code.toUpperCase().replace(/\s/g, ''),
    });
    return zone.save();
  }

  async findAll(filters?: {
    isActive?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<ParkingZoneDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    return this.parkingZoneModel
      .find(query)
      .sort({ name: 1 })
      .skip(filters?.skip || 0)
      .limit(filters?.limit || 100)
      .exec();
  }

  async findOne(id: string): Promise<ParkingZoneDocument> {
    const zone = await this.parkingZoneModel.findById(id).exec();
    if (!zone) {
      throw new NotFoundException(`Parking zone #${id} not found`);
    }
    return zone;
  }

  async findByCode(code: string): Promise<ParkingZoneDocument> {
    const zone = await this.parkingZoneModel
      .findOne({ code: code.toUpperCase().replace(/\s/g, '') })
      .exec();
    if (!zone) {
      throw new NotFoundException(`Parking zone with code ${code} not found`);
    }
    return zone;
  }

  async update(
    id: string,
    updateDto: UpdateParkingZoneDto,
  ): Promise<ParkingZoneDocument> {
    const updateData: Record<string, any> = { ...updateDto };
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase().replace(/\s/g, '');
    }

    const zone = await this.parkingZoneModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!zone) {
      throw new NotFoundException(`Parking zone #${id} not found`);
    }

    return zone;
  }

  async remove(id: string): Promise<void> {
    const result = await this.parkingZoneModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Parking zone #${id} not found`);
    }
  }
}
