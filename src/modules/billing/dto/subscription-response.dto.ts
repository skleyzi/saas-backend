import { SubscriptionStatus } from '@db/enums';
import { PlanResponseDto } from '@modules/billing/dto/plan-response.dto';
import { Expose, Type } from 'class-transformer';

export class SubscriptionResponseDto {
  @Expose()
  status!: SubscriptionStatus;

  @Expose()
  currentPeriodStart!: Date;

  @Expose()
  currentPeriodEnd!: Date;

  @Expose()
  cancelAtPeriodEnd!: boolean;

  @Expose()
  @Type(() => PlanResponseDto)
  plan!: PlanResponseDto;

  constructor(partial: Partial<SubscriptionResponseDto>) {
    Object.assign(this, partial);
  }
}
