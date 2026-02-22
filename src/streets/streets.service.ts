import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Street, StreetDocument, StreetType } from './schemas/street.schema';
import { CreateStreetDto } from './dto/create-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';
import { MapMatchingService } from './map-matching.service';

@Injectable()
export class StreetsService {
  private readonly logger = new Logger(StreetsService.name);

  constructor(
    @InjectModel(Street.name)
    private streetModel: Model<StreetDocument>,
    private mapMatchingService: MapMatchingService,
  ) {}

  async create(createStreetDto: CreateStreetDto): Promise<Street> {
    const matchedEncodedPolyline = await this._matchPolyline(
      createStreetDto.encodedPolyline,
    );

    const street = new this.streetModel({
      ...createStreetDto,
      zoneId: new Types.ObjectId(createStreetDto.zoneId),
      ...(matchedEncodedPolyline ? { matchedEncodedPolyline } : {}),
    });
    return street.save();
  }

  async createBulk(createStreetDtos: CreateStreetDto[]): Promise<Street[]> {
    // Match all polylines in parallel — non-blocking if any fail
    const matchedPolylines = await Promise.all(
      createStreetDtos.map((dto) => this._matchPolyline(dto.encodedPolyline)),
    );

    const streets = createStreetDtos.map((dto, i) => ({
      ...dto,
      zoneId: new Types.ObjectId(dto.zoneId),
      ...(matchedPolylines[i] ? { matchedEncodedPolyline: matchedPolylines[i] } : {}),
    }));
    return this.streetModel.insertMany(streets);
  }

  async findAll(filters?: {
    zoneId?: string;
    zoneIds?: string[];
    type?: StreetType;
    leftType?: StreetType;
    rightType?: StreetType;
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

    // Legacy: type matches any street where either side has this type
    if (filters?.type) {
      query.$or = [
        { leftType: filters.type },
        { rightType: filters.type },
      ];
    }

    if (filters?.leftType) {
      query.leftType = filters.leftType;
    }

    if (filters?.rightType) {
      query.rightType = filters.rightType;
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

    if (updateStreetDto.encodedPolyline) {
      const matched = await this._matchPolyline(updateStreetDto.encodedPolyline);
      if (matched) {
        updateData.matchedEncodedPolyline = matched;
      }
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

  async matchPreview(
    encodedPolyline: string,
  ): Promise<{ matchedEncodedPolyline: string | null }> {
    const matched = await this._matchPolyline(encodedPolyline);
    return { matchedEncodedPolyline: matched };
  }

  private async _matchPolyline(encodedPolyline: string): Promise<string | null> {
    try {
      const latLngCoords = this.mapMatchingService.decodePolyline(encodedPolyline);
      if (latLngCoords.length < 2) return null;

      // Convert [lat, lng] → [lng, lat] for Mapbox API
      const lngLatCoords = latLngCoords.map(
        ([lat, lng]) => [lng, lat] as [number, number],
      );

      const matched = await this.mapMatchingService.matchCoordinates(lngLatCoords);
      if (!matched) return null;

      // Convert matched [lng, lat] → [lat, lng] for Google encoding
      const matchedLatLng = matched.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      return this.mapMatchingService.encodePolyline(matchedLatLng);
    } catch (error) {
      this.logger.warn(`Failed to match polyline: ${error}`);
      return null;
    }
  }
}
