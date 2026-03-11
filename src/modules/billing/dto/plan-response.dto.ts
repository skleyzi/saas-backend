import { BillingInterval } from '@db/enums';
import { Expose } from 'class-transformer';

export class PlanResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  interval!: BillingInterval;

  @Expose()
  intervalCount!: number;

  @Expose()
  priceInCents!: number;

  @Expose()
  currency!: string;

  @Expose()
  maxResources!: number;

  constructor(partial: Partial<PlanResponseDto>) {
    Object.assign(this, partial);
  }
}
