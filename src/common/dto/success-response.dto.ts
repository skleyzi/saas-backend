import { Expose } from 'class-transformer';

export class SuccessResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  message?: string;

  constructor(message?: string) {
    this.success = true;
    this.message = message;
  }
}
