import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Street, StreetDocument, StreetType } from './schemas/street.schema';
import { CreateStreetDto } from './dto/create-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';

@Injectable()
export class StreetsService {
  constructor(
    @InjectModel(Street.name)
    private streetModel: Model<StreetDocument>,
  ) {}

  async create(createStreetDto: CreateStreetDto): Promise<Street> {
    const street = new this.streetModel({
      ...createStreetDto,
      zoneId: new Types.ObjectId(createStreetDto.zoneId),
    });
    return street.save();
  }

  async createBulk(createStreetDtos: CreateStreetDto[]): Promise<Street[]> {
    const streets = createStreetDtos.map((dto) => ({
      ...dto,
      zoneId: new Types.ObjectId(dto.zoneId),
    }));
    return this.streetModel.insertMany(streets);
  }

  async findAll(filters?: {
    zoneId?: string;
    zoneIds?: string[];
    type?: StreetType;
    isActive?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<Street[]> {
    const query: Record<string, unknown> = {};

    if (filters?.zoneIds && filters.zoneIds.length > 0) {
      // Filter by multiple zone IDs (for non-super_admin operators)
      query.zoneId = {
        $in: filters.zoneIds.map((id) => new Types.ObjectId(id)),
      };
    } else if (filters?.zoneId) {
      query.zoneId = new Types.ObjectId(filters.zoneId);
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    return this.streetModel
      .find(query)
      .limit(filters?.limit || 0)
      .skip(filters?.skip || 0)
      .exec();
  }

  async findByZone(zoneId: string): Promise<Street[]> {
    return this.streetModel
      .find({
        zoneId: new Types.ObjectId(zoneId),
        isActive: true,
      })
      .exec();
  }

  async findOne(id: string): Promise<Street> {
    const street = await this.streetModel.findById(id).exec();
    if (!street) {
      throw new NotFoundException(`Street with ID "${id}" not found`);
    }
    return street;
  }

  async update(id: string, updateStreetDto: UpdateStreetDto): Promise<Street> {
    const updateData: Record<string, unknown> = { ...updateStreetDto };

    if (updateStreetDto.zoneId) {
      updateData.zoneId = new Types.ObjectId(updateStreetDto.zoneId);
    }

    const street = await this.streetModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!street) {
      throw new NotFoundException(`Street with ID "${id}" not found`);
    }
    return street;
  }

  async remove(id: string): Promise<void> {
    const result = await this.streetModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Street with ID "${id}" not found`);
    }
  }

  async removeByZone(zoneId: string): Promise<number> {
    const result = await this.streetModel
      .deleteMany({ zoneId: new Types.ObjectId(zoneId) })
      .exec();
    return result.deletedCount;
  }
}
