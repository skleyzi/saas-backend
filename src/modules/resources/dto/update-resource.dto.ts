import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;
}
