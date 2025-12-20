import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { StreetType } from '../schemas/street.schema';

export class CreateStreetDto {
  @IsMongoId()
  @IsNotEmpty()
  zoneId: string;

  @IsEnum(StreetType)
  @IsNotEmpty()
  type: StreetType;

  @IsString()
  @IsNotEmpty()
  encodedPolyline: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
