import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, TenantContext } from '@closetrent/types';
import {
  UpdateStoreSettingsDto,
  UpdateLocaleSettingsDto,
  UpdatePaymentSettingsDto,
  UpdateCourierSettingsDto,
  UpdateOperationalSettingsDto,
  SetCustomDomainDto,
} from './dto/update-settings.dto';

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // =========================================================================
  // TENANT INFO
  // =========================================================================

  /**
   * GET /api/v1/tenant
   * Get the current tenant details (resolved from request context).
   */
  @Get()
  @Roles('owner', 'manager', 'staff')
  async getCurrentTenant(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() _user: AuthUser,
  ) {
    return this.tenantService.findById(tenant.id);
  }

  /**
   * GET /api/v1/tenant/public
   * Get public tenant info for storefront rendering (branding, contact, social links).
   * No authentication required.
   */
  @Get('public')
  @Public()
  async getPublicStoreInfo(@CurrentTenant() tenant: TenantContext) {
    return this.tenantService.getPublicStoreInfo(tenant.id);
  }

  // =========================================================================
  // STORE SETTINGS
  // =========================================================================

  /**
   * GET /api/v1/tenant/settings
   * Get full store settings (owner only — includes sensitive fields).
   */
  @Get('settings')
  @Roles('owner')
  async getStoreSettings(@CurrentTenant() tenant: TenantContext) {
    return this.tenantService.getStoreSettings(tenant.id);
  }

  /**
   * PATCH /api/v1/tenant/settings
   * Update branding, contact, and social link settings.
   */
  @Patch('settings')
  @Roles('owner')
  async updateStoreSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateStoreSettingsDto,
  ) {
    return this.tenantService.updateStoreSettings(tenant.id, dto);
  }

  /**
   * PATCH /api/v1/tenant/locale
   * Update locale settings (timezone, currency, date format, etc.).
   */
  @Patch('locale')
  @Roles('owner')
  async updateLocaleSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateLocaleSettingsDto,
  ) {
    return this.tenantService.updateLocaleSettings(tenant.id, dto);
  }

  /**
   * PATCH /api/v1/tenant/payment-settings
   * Update payment configuration (bKash, Nagad, SSLCommerz).
   */
  @Patch('payment-settings')
  @Roles('owner')
  async updatePaymentSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.tenantService.updatePaymentSettings(tenant.id, dto);
  }

  /**
   * PATCH /api/v1/tenant/courier-settings
   * Update courier configuration.
   */
  @Patch('courier-settings')
  @Roles('owner')
  async updateCourierSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateCourierSettingsDto,
  ) {
    return this.tenantService.updateCourierSettings(tenant.id, dto);
  }

  /**
   * PATCH /api/v1/tenant/operational-settings
   * Update operational settings (buffer days, session limits, SMS).
   */
  @Patch('operational-settings')
  @Roles('owner')
  async updateOperationalSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateOperationalSettingsDto,
  ) {
    return this.tenantService.updateOperationalSettings(tenant.id, dto);
  }

  // =========================================================================
  // CUSTOM DOMAIN
  // =========================================================================

  /**
   * POST /api/v1/tenant/custom-domain
   * Set custom domain for the tenant's store.
   */
  @Post('custom-domain')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async setCustomDomain(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: SetCustomDomainDto,
  ) {
    return this.tenantService.setCustomDomain(tenant.id, dto.domain);
  }

  /**
   * POST /api/v1/tenant/custom-domain/verify
   * Verify DNS configuration for the tenant's custom domain.
   */
  @Post('custom-domain/verify')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async verifyCustomDomain(@CurrentTenant() tenant: TenantContext) {
    return this.tenantService.verifyCustomDomain(tenant.id);
  }

  /**
   * DELETE /api/v1/tenant/custom-domain
   * Remove custom domain from the tenant's store.
   */
  @Delete('custom-domain')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async removeCustomDomain(@CurrentTenant() tenant: TenantContext) {
    return this.tenantService.removeCustomDomain(tenant.id);
  }

  // =========================================================================
  // SUBSCRIPTION
  // =========================================================================

  /**
   * GET /api/v1/tenant/subscription
   * Get current subscription with plan details and computed status.
   */
  @Get('subscription')
  @Roles('owner')
  async getSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptionService.getCurrentSubscription(tenant.id);
  }

  /**
   * GET /api/v1/tenant/resource-usage
   * Get current resource usage (products, staff) vs plan limits.
   */
  @Get('resource-usage')
  @Roles('owner')
  async getResourceUsage(@CurrentTenant() tenant: TenantContext) {
    const [products, staff, orders] = await Promise.all([
      this.subscriptionService.checkPlanLimit(tenant.id, 'products'),
      this.subscriptionService.checkPlanLimit(tenant.id, 'staff'),
      this.subscriptionService.checkPlanLimit(tenant.id, 'orders'),
    ]);
    return { products, staff, orders };
  }

  /**
   * GET /api/v1/tenant/billing-history
   * Get the history of subscription payments/invoices.
   */
  @Get('billing-history')
  @Roles('owner')
  async getBillingHistory(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptionService.getBillingHistory(tenant.id);
  }
}
