import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LicensePlateDto } from '../../shared/license-plate/license-plate.dto';

export class CreateBadgeDto {
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

  @IsString()
  @IsNotEmpty()
  zoneId: string;

  @IsString()
  @IsNotEmpty()
  zoneName: string;
}
