import {
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlateInputDto } from './add-vehicle.dto';

export class UpdateVehicleDto {
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
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
