import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  agentCode: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Username can only contain letters, numbers, dots, dashes and underscores',
  })
  username: string;

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
