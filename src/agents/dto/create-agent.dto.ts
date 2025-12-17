import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  agentCode: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedZones?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
