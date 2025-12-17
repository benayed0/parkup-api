import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class LoginAgentDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
