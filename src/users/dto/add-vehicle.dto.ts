import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlateType } from '../../shared/license-plate';

/**
 * Structured license plate input
 */
export class PlateInputDto {
  @IsEnum(PlateType)
  type: PlateType;

  @IsOptional()
  @IsString()
  left?: string;

  @IsOptional()
  @IsString()
  right?: string;
}

export class AddVehicleDto {
  /**
   * Structured license plate (preferred)
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PlateInputDto)
  plate?: PlateInputDto;

  /**
   * @deprecated Use plate instead
   * Legacy string format for backward compatibility
   */
  @ValidateIf((o) => !o.plate)
  @IsString()
  @IsNotEmpty()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
