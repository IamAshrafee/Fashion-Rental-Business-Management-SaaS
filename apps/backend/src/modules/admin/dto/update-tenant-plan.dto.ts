import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { BillingCycle } from '@prisma/client';

export class UpdateTenantPlanDto {
  @IsUUID(4)
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle!: BillingCycle;
}
