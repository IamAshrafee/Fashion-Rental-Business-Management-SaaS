import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PricingAdminService } from './pricing-admin.service';
import { PricingEngineService } from './pricing-engine.service';
import { SavePricingDto, SimulatePricingDto } from './dto/pricing-engine.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser, TenantContext } from '@closetrent/types';

@Controller('products/:productId/pricing')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@RequirePermission('manage_products')
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
  async getPricing(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
  ) {
    return this.adminService.getPricingProfile(tenant.id, productId);
  }

  /**
   * POST /api/products/:productId/pricing
   * Save pricing configuration (creates/updates profile + publishes new version).
   */
  @Post()
  @Roles('owner', 'manager')
  async savePricing(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SavePricingDto,
  ) {
    return this.adminService.savePricing(tenant.id, productId, {
      ratePlan: dto.ratePlan,
      components: dto.components,
      lateFeePolicy: dto.lateFeePolicy,
    }, user.id);
  }

  /**
   * POST /api/products/:productId/pricing/simulate
   * Preview: compute a quote without persisting it.
   */
  @Post('simulate')
  @Roles('owner', 'manager')
  async simulate(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Body() dto: SimulatePricingDto,
  ) {
    const result = await this.pricingEngine.computeQuote({
      tenantId: tenant.id,
      productId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      selectedAddons: dto.selectedAddons,
    });

    return {
      currency: result.currency,
      billableDays: result.billableDays,
      lineItems: result.lineItems,
      totals: {
        subtotalMinor: result.subtotalMinor,
        depositMinor: result.depositMinor,
        totalDueNowMinor: result.totalDueNowMinor,
        totalDueLaterMinor: result.totalDueLaterMinor,
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
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
  ) {
    return this.adminService.deletePricingProfile(tenant.id, productId);
  }
}
