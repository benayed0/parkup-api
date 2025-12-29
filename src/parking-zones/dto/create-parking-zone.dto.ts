import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeasonalPeriodDto } from './seasonal-period.dto';

export class CreateParkingZoneDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: number[]; // [longitude, latitude]

  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  address?: string;
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsNumber()
  hourlyRate: number;

  @IsString()
  @IsNotEmpty()
  operatingHours: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeasonalPeriodDto)
  seasonalOperatingHours?: SeasonalPeriodDto[];

  @IsNotEmpty()
  prices: { car_sabot: number; pound: number };

  @IsOptional()
  @IsNumber()
  numberOfPlaces?: number;
}
