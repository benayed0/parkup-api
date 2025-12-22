import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LicensePlateDto } from '../../shared/license-plate';

/**
 * DTO for checking vehicle by structured license plate
 */
export class CheckVehicleDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LicensePlateDto)
  plate: LicensePlateDto;
}
