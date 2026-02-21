import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/enums';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
