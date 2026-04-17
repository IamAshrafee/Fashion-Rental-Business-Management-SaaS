import { Module } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { PricingEngineController } from './pricing-engine.controller';
import { PricingAdminController } from './pricing-admin.controller';
import { PricingAdminService } from './pricing-admin.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PricingEngineController, PricingAdminController],
  providers: [PricingEngineService, PricingAdminService],
  exports: [PricingEngineService],
})
export class PricingEngineModule {}
