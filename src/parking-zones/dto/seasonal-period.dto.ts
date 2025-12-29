import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  ValidateIf,
  Matches,
} from 'class-validator';

export class SeasonalPeriodDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  startMonth: number;

  @IsNumber()
  @Min(1)
  @Max(31)
  startDay: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  endMonth: number;

  @IsNumber()
  @Min(1)
  @Max(31)
  endDay: number;

  @IsBoolean()
  is24h: boolean;

  @ValidateIf((o) => !o.is24h)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'hoursFrom must be in HH:MM format' })
  hoursFrom?: string;

  @ValidateIf((o) => !o.is24h)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'hoursTo must be in HH:MM format' })
  hoursTo?: string;
}
