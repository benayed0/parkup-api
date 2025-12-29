import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ParkingZone,
  ParkingZoneDocument,
} from './schemas/parking-zone.schema';
import { CreateParkingZoneDto, UpdateParkingZoneDto } from './dto';
import { SeasonalPeriod } from './interfaces/seasonal-hours.interface';

@Injectable()
export class ParkingZonesService {
  constructor(
    @InjectModel(ParkingZone.name)
    private parkingZoneModel: Model<ParkingZoneDocument>,
  ) {}

  /**
   * Validate that seasonal periods do not overlap
   */
  validateNoOverlap(periods: SeasonalPeriod[]): void {
    if (!periods || periods.length < 2) return;

    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        if (this.periodsOverlap(periods[i], periods[j])) {
          throw new BadRequestException(
            `Seasonal periods "${periods[i].name}" and "${periods[j].name}" have overlapping dates`,
          );
        }
      }
    }
  }

  /**
   * Check if two seasonal periods overlap
   */
  private periodsOverlap(a: SeasonalPeriod, b: SeasonalPeriod): boolean {
    const aStart = a.startMonth * 100 + a.startDay;
    const aEnd = a.endMonth * 100 + a.endDay;
    const bStart = b.startMonth * 100 + b.startDay;
    const bEnd = b.endMonth * 100 + b.endDay;

    // Handle year-crossing ranges
    const aWraps = aEnd < aStart;
    const bWraps = bEnd < bStart;

    if (!aWraps && !bWraps) {
      // Neither wraps: simple overlap check
      return aStart <= bEnd && bStart <= aEnd;
    } else if (aWraps && bWraps) {
      // Both wrap: they always overlap
      return true;
    } else {
      // One wraps: check if the non-wrapping range falls within the gap
      const [wrapping, normal] = aWraps ? [a, b] : [b, a];
      const wStart = wrapping.startMonth * 100 + wrapping.startDay;
      const wEnd = wrapping.endMonth * 100 + wrapping.endDay;
      const nStart = normal.startMonth * 100 + normal.startDay;
      const nEnd = normal.endMonth * 100 + normal.endDay;

      // Wrapping range covers: [wStart, 1231] and [101, wEnd]
      // They overlap if normal range touches either part
      return nStart <= wEnd || nEnd >= wStart;
    }
  }

  /**
   * Get the current operating hours string based on seasonal configuration
   */
  getCurrentOperatingHours(zone: ParkingZoneDocument, date?: Date): string {
    const now = date || new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentDay = now.getDate();

    // If no seasonal hours defined, use default operatingHours
    if (
      !zone.seasonalOperatingHours ||
      zone.seasonalOperatingHours.length === 0
    ) {
      return zone.operatingHours;
    }

    // Find matching seasonal period
    const matchingPeriod = zone.seasonalOperatingHours.find((period) =>
      this.isDateInRange(currentMonth, currentDay, period),
    );

    if (!matchingPeriod) {
      // No matching period, use default
      return zone.operatingHours;
    }

    // Return formatted hours
    if (matchingPeriod.is24h) {
      return '24h/24';
    }
    return `${matchingPeriod.hoursFrom} - ${matchingPeriod.hoursTo}`;
  }

  /**
   * Check if a date (month/day) falls within a seasonal period
   * Handles year-crossing ranges (e.g., Nov 15 - Feb 28)
   */
  private isDateInRange(
    month: number,
    day: number,
    period: SeasonalPeriod,
  ): boolean {
    const current = month * 100 + day;
    const start = period.startMonth * 100 + period.startDay;
    const end = period.endMonth * 100 + period.endDay;

    if (start <= end) {
      // Normal range (e.g., March 1 to October 31)
      return current >= start && current <= end;
    } else {
      // Year-crossing range (e.g., November 15 to February 28)
      return current >= start || current <= end;
    }
  }

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
    // Validate seasonal periods don't overlap
    if (createDto.seasonalOperatingHours) {
      this.validateNoOverlap(createDto.seasonalOperatingHours);
    }

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
    // Validate seasonal periods don't overlap
    if (updateDto.seasonalOperatingHours) {
      this.validateNoOverlap(updateDto.seasonalOperatingHours);
    }

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
