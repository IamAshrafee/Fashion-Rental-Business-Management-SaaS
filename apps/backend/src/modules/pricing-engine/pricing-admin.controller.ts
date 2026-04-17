import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PricingAdminService } from './pricing-admin.service';
import { PricingEngineService } from './pricing-engine.service';
import { SavePricingDto, SimulatePricingDto } from './dto/pricing-engine.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('api/products/:productId/pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingAdminController {
  constructor(
    private readonly adminService: PricingAdminService,
    private readonly pricingEngine: PricingEngineService,
  ) {}

  /**
   * GET /api/products/:productId/pricing
   * Returns the full pricing profile + all versions for admin editing.
   */
  @Get()
  @Roles('owner', 'manager')
  async getPricing(@Req() req: any, @Param('productId') productId: string): Promise<any> {
    const tenantId = req.user.tenantId;
    const profile = await this.adminService.getPricingProfile(
      tenantId,
      productId,
    );

    return {
      success: true,
      data: profile, // null = legacy product with no profile yet
    };
  }

  /**
   * POST /api/products/:productId/pricing
   * Save pricing configuration (creates/updates profile + publishes new version).
   */
  @Post()
  @Roles('owner', 'manager')
  async savePricing(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: SavePricingDto,
  ): Promise<any> {
    const tenantId = req.user.tenantId;

    const result = await this.adminService.savePricing(tenantId, productId, {
      ratePlan: dto.ratePlan,
      components: dto.components,
      lateFeePolicy: dto.lateFeePolicy as any,
    });

    return {
      success: true,
      data: result,
      message: `Pricing v${result.version} published`,
    };
  }

  /**
   * POST /api/products/:productId/pricing/simulate
   * Preview: compute a quote without persisting it.
   */
  @Post('simulate')
  @Roles('owner', 'manager')
  async simulate(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: SimulatePricingDto,
  ): Promise<any> {
    const tenantId = req.user.tenantId;

    const product = await this.pricingEngine['prisma'].product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { purchasePrice: true },
    });

    const result = await this.pricingEngine.computeQuote({
      tenantId,
      productId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      retailPriceMinor: product?.purchasePrice ?? undefined,
      selectedAddons: dto.selectedAddons,
    });

    return {
      success: true,
      data: {
        currency: result.currency,
        billableDays: result.billableDays,
        lineItems: result.lineItems,
        totals: {
          subtotalMinor: result.subtotalMinor,
          depositMinor: result.depositMinor,
          totalDueNowMinor: result.totalDueNowMinor,
          totalDueLaterMinor: result.totalDueLaterMinor,
        },
      },
    };
  }

  /**
   * DELETE /api/products/:productId/pricing
   * Remove pricing profile entirely.
   */
  @Delete()
  @Roles('owner')
  async deletePricing(
    @Req() req: any,
    @Param('productId') productId: string,
  ): Promise<any> {
    const tenantId = req.user.tenantId;
    const result = await this.adminService.deletePricingProfile(tenantId, productId);
    return { success: true, ...result };
  }
}
