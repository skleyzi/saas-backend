import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
