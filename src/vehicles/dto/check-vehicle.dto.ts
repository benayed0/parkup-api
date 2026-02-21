import {
  IsString,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LicensePlateDto } from '../../shared/license-plate/license-plate.dto';

export class CheckVehicleDto {
  @ValidateIf((o) => !o.licensePlate)
  @IsOptional()
  @ValidateNested()
  @Type(() => LicensePlateDto)
  plate?: LicensePlateDto;

  @ValidateIf((o) => !o.plate)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;
}
