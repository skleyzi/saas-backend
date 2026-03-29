import { Role } from '@db/enums';
import { SubscriptionResponseDto } from '@modules/billing/dto/subscription-response.dto';
import { Expose, Type } from 'class-transformer';

export class AdminUserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  stripeCustomerId?: string | null;

  @Expose()
  email!: string;

  @Expose()
  name!: string;

  @Expose()
  role!: Role;

  @Expose()
  isActive!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  @Type(() => SubscriptionResponseDto)
  subscriptions!: SubscriptionResponseDto[];

  constructor(partial: Partial<AdminUserResponseDto>) {
    Object.assign(this, partial);
  }
}
