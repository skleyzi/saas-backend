import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  /** @example "Password1_23" */
  @IsNotEmpty()
  @IsStrongPassword()
  @MinLength(8)
  password!: string;

  /** @example "John Doe" */
  @IsNotEmpty()
  @IsString()
  name!: string;
}
