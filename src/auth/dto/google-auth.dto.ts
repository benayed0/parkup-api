import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class GoogleAuthDto {
  // idToken from mobile (Google Sign-In native)
  @IsString()
  @IsOptional()
  idToken?: string;

  // accessToken from web (Google Sign-In web flow)
  @IsString()
  @IsOptional()
  accessToken?: string;

  // At least one token must be provided
  @ValidateIf((o) => !o.idToken && !o.accessToken)
  @IsString()
  requiredToken?: string; // This will fail validation if both are missing
}
