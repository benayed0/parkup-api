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
  leftType: StreetType;

  @IsEnum(StreetType)
  @IsNotEmpty()
  rightType: StreetType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  encodedPolyline: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  matchedEncodedPolyline?: string;
}
