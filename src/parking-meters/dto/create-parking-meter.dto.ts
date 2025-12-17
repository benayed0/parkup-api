import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
} from 'class-validator';

export class CreateParkingMeterDto {
  @IsString()
  @IsNotEmpty()
  zoneId: string;

  @IsString()
  @IsNotEmpty()
  parkingCode: string;

  @IsString()
  @IsNotEmpty()
  zoneName: string;

  @IsNumber()
  @Min(0)
  hourlyRate: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDurationMinutes?: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: number[]; // [longitude, latitude]

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @IsNotEmpty()
  operatingHours: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
