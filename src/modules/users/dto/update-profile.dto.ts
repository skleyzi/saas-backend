import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  /** @example "Jane Doe" */
  @IsOptional()
  @IsString()
  name?: string;
}
