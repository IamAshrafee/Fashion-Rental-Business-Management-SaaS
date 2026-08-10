import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { GetQuoteDto } from './dto/pricing-engine.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import type { TenantContext } from '@closetrent/types';

@Controller('pricing')
@UseGuards(TenantGuard)
export class PricingEngineController {
  constructor(private readonly pricingEngine: PricingEngineService) {}

  /**
   * POST /api/pricing/quote
   *
   * Public-facing Quote API: given a product + dates + context,
   * returns an itemized, deterministic pricing breakdown.
   */
  @Post('quote')
  async getQuote(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GetQuoteDto,
  ) {
    return this.pricingEngine.createQuote({
      tenantId: tenant.id,
      productId: dto.productId,
      variantId: dto.variantId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      context: dto.context,
      selectedAddons: dto.selectedAddons,
    });
  }
}
