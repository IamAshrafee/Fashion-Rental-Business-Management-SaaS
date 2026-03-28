import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  controllers: [TenantController],
  providers: [TenantService, SubscriptionService],
  exports: [TenantService, SubscriptionService],
})
export class TenantModule {}
