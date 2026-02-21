import { Injectable, BadRequestException } from '@nestjs/common';
import { ParkingSessionsService } from '../parking-sessions/parking-sessions.service';
import { LicensePlateBadgesService } from '../license-plate-badges/license-plate-badges.service';
import {
  normalizeLicensePlate,
  createLicensePlate,
  parseLicensePlateString,
} from '../shared/license-plate/license-plate.schema';
import { PlateType } from '../shared/license-plate/license-plate.types';
import { CheckVehicleDto } from './dto/check-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly parkingSessionsService: ParkingSessionsService,
    private readonly licensePlateBadgesService: LicensePlateBadgesService,
  ) {}

  async checkVehicle(dto: CheckVehicleDto) {
    const { plate, licensePlate: licensePlateStr, zoneId } = dto;

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

    const [sessions, badge] = await Promise.all([
      structuredPlate
        ? this.parkingSessionsService.findActiveByPlate(
            {
              type: structuredPlate.type,
              left: structuredPlate.left,
              right: structuredPlate.right,
              formatted: structuredPlate.formatted,
            },
            zoneId,
          )
        : this.parkingSessionsService.findActiveByLicensePlate(
            normalizedLicensePlate,
          ),
      this.licensePlateBadgesService.findByPlate(normalizedLicensePlate),
    ]);

    const activeParkingSession = sessions.length > 0 ? sessions[0] : null;

    return {
      plate: structuredPlate,
      activeParkingSession,
      badge,
    };
  }
}
