import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { OperatorRole } from '../schemas/operator.schema';

export class CreateOperatorDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(OperatorRole)
  role?: OperatorRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zoneIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
