import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AddVehicleDto {
  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
