import { Expose } from 'class-transformer';

export class ResourceResponseDto {
  @Expose()
  id!: string;

  @Expose()
  title!: string;

  @Expose()
  content?: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  constructor(partial: Partial<ResourceResponseDto>) {
    Object.assign(this, partial);
  }
}
