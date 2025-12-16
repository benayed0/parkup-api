import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookAuthDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
