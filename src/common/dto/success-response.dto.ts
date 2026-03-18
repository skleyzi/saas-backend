export class SuccessResponseDto {
  success: boolean;
  message?: string;

  constructor(message?: string) {
    this.success = true;
    this.message = message;
  }
}
