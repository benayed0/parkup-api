import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class GenerateQrDto {
  @IsString()
  zoneId: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1000)
  size?: number = 300;
}

export class GenerateBulkQrDto {
  @IsString({ each: true })
  zoneIds: string[];

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1000)
  size?: number = 300;
}
