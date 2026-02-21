import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LicensePlateBadge,
  LicensePlateBadgeDocument,
  BadgeStatus,
} from './schemas/license-plate-badge.schema';
import { CreateBadgeDto } from './dto/create-badge.dto';
import {
  normalizeLicensePlate,
  createLicensePlate,
  parseLicensePlateString,
} from '../shared/license-plate/license-plate.schema';
import { PlateType } from '../shared/license-plate/license-plate.types';

@Injectable()
export class LicensePlateBadgesService {
  constructor(
    @InjectModel(LicensePlateBadge.name)
    private readonly badgeModel: Model<LicensePlateBadgeDocument>,
  ) {}

  async create(
    agentId: string,
    dto: CreateBadgeDto,
  ): Promise<LicensePlateBadgeDocument> {
    const { plate, licensePlate: licensePlateStr, zoneId, zoneName } = dto;

    let structuredPlate;
    let normalizedLicensePlate: string;

    if (plate) {
      structuredPlate = createLicensePlate(
        plate.type as PlateType,
        plate.left,
        plate.right,
      );
      normalizedLicensePlate = normalizeLicensePlate(structuredPlate);
    } else if (licensePlateStr) {
      normalizedLicensePlate = normalizeLicensePlate(licensePlateStr);
      structuredPlate = parseLicensePlateString(licensePlateStr);
    } else {
      throw new BadRequestException('plate ou licensePlate est requis');
    }

    const currentYear = new Date().getFullYear();

    const existing = await this.badgeModel.findOne({
      licensePlate: normalizedLicensePlate,
      year: currentYear,
      status: BadgeStatus.ACTIVE,
    });

    if (existing) {
      throw new ConflictException(
        `Une vignette active existe déjà pour cette plaque en ${currentYear}`,
      );
    }

    const badge = new this.badgeModel({
      plate: structuredPlate,
      licensePlate: normalizedLicensePlate,
      zoneId: new Types.ObjectId(zoneId),
      zoneName,
      year: currentYear,
      agentId: new Types.ObjectId(agentId),
      status: BadgeStatus.ACTIVE,
    });

    return badge.save();
  }

  async findAll(filters: {
    licensePlate?: string;
    zoneId?: string;
    year?: number;
    status?: BadgeStatus;
    limit?: number;
    skip?: number;
  }): Promise<LicensePlateBadgeDocument[]> {
    const query: Record<string, any> = {};

    if (filters.licensePlate) {
      query.licensePlate = normalizeLicensePlate(filters.licensePlate);
    }
    if (filters.zoneId) {
      query.zoneId = new Types.ObjectId(filters.zoneId);
    }
    if (filters.year) {
      query.year = filters.year;
    }
    if (filters.status) {
      query.status = filters.status;
    }

    return this.badgeModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(filters.skip || 0)
      .limit(filters.limit || 50)
      .exec();
  }

  async findByPlate(
    licensePlate: string,
    year?: number,
  ): Promise<LicensePlateBadgeDocument | null> {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    const targetYear = year || new Date().getFullYear();

    return this.badgeModel
      .findOne({
        licensePlate: normalizedPlate,
        year: targetYear,
      })
      .exec();
  }

  async invalidate(
    id: string,
    agentId: string,
  ): Promise<LicensePlateBadgeDocument> {
    const badge = await this.badgeModel.findById(id).exec();

    if (!badge) {
      throw new NotFoundException(`Vignette #${id} non trouvée`);
    }

    if (badge.status === BadgeStatus.INVALIDATED) {
      throw new BadRequestException('Cette vignette est déjà invalidée');
    }

    badge.status = BadgeStatus.INVALIDATED;
    badge.invalidatedAt = new Date();
    badge.invalidatedByAgentId = new Types.ObjectId(agentId);

    return badge.save();
  }
}
