import { IsString, IsNotEmpty } from 'class-validator';

export class LoginAgentDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
