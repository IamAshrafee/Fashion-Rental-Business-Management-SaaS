import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { GetQuoteDto } from './dto/pricing-engine.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('api/pricing')
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
  async getQuote(@Req() req: any, @Body() dto: GetQuoteDto) {
    const tenantId = req.tenantId;

    // Load product to get retail price
    const product = await this.pricingEngine['prisma'].product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
      select: { purchasePrice: true },
    });

    const result = await this.pricingEngine.computeQuote({
      tenantId,
      productId: dto.productId,
      variantId: dto.variantId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      context: dto.context,
      selectedAddons: dto.selectedAddons,
      retailPriceMinor: product?.purchasePrice ?? undefined,
    });

    // Persist quote for audit/caching
    const inputsHash = this.pricingEngine.computeInputsHash({
      tenantId,
      productId: dto.productId,
      variantId: dto.variantId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      context: dto.context,
      selectedAddons: dto.selectedAddons,
    });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL

    const quote = await this.pricingEngine['prisma'].quote.create({
      data: {
        tenantId,
        productId: dto.productId,
        variantId: dto.variantId,
        policyVersionId: result.policyVersionId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        customerContext: dto.context as any,
        selectedAddons: dto.selectedAddons as any,
        inputsHash,
        currency: result.currency,
        billableDays: result.billableDays,
        subtotalMinor: result.subtotalMinor,
        depositMinor: result.depositMinor,
        totalDueNowMinor: result.totalDueNowMinor,
        totalDueLaterMinor: result.totalDueLaterMinor,
        expiresAt,
        lineItems: {
          create: result.lineItems
            .filter((li) => li.visibility === 'CUSTOMER')
            .map((li) => ({
              type: li.type,
              label: li.label,
              amountMinor: li.amountMinor,
              refundable: li.refundable,
              visibility: li.visibility as any,
              metadata: li.metadata as any,
            })),
        },
      },
      include: { lineItems: true },
    });

    return {
      success: true,
      data: {
        quoteId: quote.id,
        policyVersionId: result.policyVersionId,
        currency: result.currency,
        duration: {
          billableDays: result.billableDays,
          startAt: dto.startAt,
          endAt: dto.endAt,
        },
        lineItems: quote.lineItems.map((li) => ({
          type: li.type,
          label: li.label,
          amountMinor: li.amountMinor,
          refundable: li.refundable,
          visibility: li.visibility,
        })),
        totals: {
          subtotalMinor: result.subtotalMinor,
          depositMinor: result.depositMinor,
          totalDueNowMinor: result.totalDueNowMinor,
          totalDueLaterMinor: result.totalDueLaterMinor,
        },
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}
