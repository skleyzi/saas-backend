import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  /** @example "Password1_23" */
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
