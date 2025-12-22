import {
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlateType, PlateCategory } from './license-plate.types';

/**
 * DTO for structured license plate input
 */
export class LicensePlateDto {
  @IsEnum(PlateType)
  type: PlateType;

  @IsOptional()
  @IsEnum(PlateCategory)
  category?: PlateCategory;

  @IsOptional()
  @IsString()
  left?: string;

  @IsOptional()
  @IsString()
  right?: string;

  @IsOptional()
  @IsString()
  formatted?: string;
}

/**
 * DTO that accepts either structured or string format
 * For backward compatibility during migration
 */
export class LicensePlateInputDto {
  @ValidateIf((o) => !o.licensePlate)
  @IsOptional()
  @Type(() => LicensePlateDto)
  plate?: LicensePlateDto;

  @ValidateIf((o) => !o.plate)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  licensePlate?: string;
}
