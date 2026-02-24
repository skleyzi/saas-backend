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

  @IsNotEmpty()
  @IsStrongPassword()
  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;
}
