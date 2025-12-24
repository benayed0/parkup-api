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

  /**
   * Fetch boundaries from Nominatim API for a given place name
   */
  private async fetchBoundariesFromNominatim(
    placeName: string,
  ): Promise<number[][] | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&polygon_geojson=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ParkUp/1.0' }, // Required by Nominatim
      });
      const data = await response.json();

      // Find the result with a Polygon boundary (administrative boundary)
      const boundaryResult = data.find(
        (r: any) => r.geojson?.type === 'Polygon' && r.class === 'boundary',
      );
      console.log(data);

      if (boundaryResult?.geojson?.coordinates?.[0]) {
        return boundaryResult.geojson.coordinates[0];
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch boundaries for ${placeName}:`, error);
      return null;
    }
  }

  async create(createDto: CreateParkingZoneDto): Promise<ParkingZoneDocument> {
    const boundaries = await this.fetchBoundariesFromNominatim(
      `${createDto.name}`,
    );
    if (!boundaries) {
      throw new NotFoundException(
        `Could not fetch boundaries for zone ${createDto.name}`,
      );
    }
    const zone = new this.parkingZoneModel({
      ...createDto,
      code: createDto.code.toUpperCase().replace(/\s/g, ''),
      location: {
        type: 'Point',
        coordinates: createDto.coordinates,
      },
      boundaries: boundaries,
    });
    return zone.save();
  }

  async findAll(filters?: {
    isActive?: boolean;
    zoneIds?: string[];
    limit?: number;
    skip?: number;
  }): Promise<ParkingZoneDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    // Filter by specific zone IDs (for non-super_admin operators)
    if (filters?.zoneIds && filters.zoneIds.length > 0) {
      query._id = { $in: filters.zoneIds };
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
