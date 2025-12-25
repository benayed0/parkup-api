import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
} from 'class-validator';

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
  @IsBoolean()
  isActive?: boolean;

  @IsNumber()
  hourlyRate: number;

  @IsString()
  @IsNotEmpty()
  operatingHours: string;

  @IsNotEmpty()
  prices: { car_sabot: number; pound: number };

  @IsOptional()
  @IsNumber()
  numberOfPlaces?: number;
}
