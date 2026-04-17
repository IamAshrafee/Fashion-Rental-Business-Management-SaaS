import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@closetrent/types';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo-code.dto';
import { SKIP_RATE_LIMIT_KEY } from '../../common/guards/tenant-rate-limit.guard';
import { SetMetadata } from '@nestjs/common';

/** Skip tenant rate limiting on admin routes — they have their own auth layer */
const SkipTenantRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Admin API Controller.
 * Bypasses regular tenant resolution to manage SaaS platform state.
 * Protected by saas_admin role requirement.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('saas_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =========================================================================
  // TENANTS
  // =========================================================================

  @Get('tenants')
  async getTenants(
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getTenants({ status, plan, paymentStatus, search, page: page!, limit: limit!, sort });
  }

  @Get('tenants/:id')
  async getTenantDetail(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  /** Point 5: Pass adminUserId for audit trail */
  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.updateTenantStatus(id, dto, user.id);
  }

  /** Pass adminUserId for audit trail */
  @Patch('tenants/:id/plan')
  async updateTenantPlan(
    @Param('id') id: string,
    @Body() dto: UpdateTenantPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.updateTenantPlan(id, dto, user.id);
  }

  @Post('tenants/:id/impersonate')
  async impersonateTenant(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.impersonateTenant(user.id, id);
  }

  /** Point 19: Soft-delete tenant */
  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.deleteTenant(id, user.id);
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  @Get('analytics/platform')
  async getPlatformAnalytics() {
    return this.adminService.getPlatformAnalytics();
  }

  // =========================================================================
  // ACTIVITY LOG (Point 20)
  // =========================================================================

  @Get('activity-log')
  async getActivityLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.getActivityLog({ page: page!, limit: limit! });
  }

  // =========================================================================
  // PLAN MANAGEMENT
  // =========================================================================

  @Get('plans')
  async getPlans() {
    return this.adminService.getPlans();
  }

  @Post('plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.adminService.updatePlan(id, dto);
  }

  // =========================================================================
  // BILLING — SUBSCRIPTION PAYMENTS
  // =========================================================================

  @Get('revenue/payments')
  async getGlobalPayments() {
    return this.adminService.getGlobalPayments();
  }

  @Post('tenants/:id/payments')
  async recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.recordPayment(id, dto, user.id);
  }

  @Get('tenants/:id/payments')
  async getPaymentHistory(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.getPaymentHistory(id, { page: page!, limit: limit! });
  }

  // =========================================================================
  // BILLING — INVOICES
  // =========================================================================

  @Post('tenants/:id/invoices')
  async generateInvoice(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.generateInvoice(id, dto, user.id);
  }

  @Get('tenants/:id/invoices')
  async getInvoices(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.getInvoices(id, { page: page!, limit: limit! });
  }

  @Patch('invoices/:id')
  async updateInvoiceStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.adminService.updateInvoiceStatus(id, dto);
  }

  // =========================================================================
  // SUBSCRIPTION EXTENSION
  // =========================================================================

  @Patch('tenants/:id/subscription/extend')
  async extendSubscription(
    @Param('id') id: string,
    @Body() dto: ExtendSubscriptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.extendSubscription(id, dto, user.id);
  }

  // =========================================================================
  // SUBSCRIPTION HISTORY
  // =========================================================================

  @Get('tenants/:id/subscription/history')
  async getSubscriptionHistory(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.getSubscriptionHistory(id, { page: page!, limit: limit! });
  }

  // =========================================================================
  // PROMO CODES
  // =========================================================================

  @Get('promo-codes')
  async getPromoCodes(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.getPromoCodes({ page: page!, limit: limit! });
  }

  @Post('promo-codes')
  async createPromoCode(
    @Body() dto: CreatePromoCodeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.createPromoCode(dto, user.id);
  }

  @Patch('promo-codes/:id')
  async updatePromoCode(
    @Param('id') id: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.adminService.updatePromoCode(id, dto);
  }

  // =========================================================================
  // RESOURCE MONITOR & OBSERVABILITY
  // =========================================================================

  /**
   * GET /api/v1/admin/resource-monitor
   * Real-time overview of all active tenants: API usage, latency, utilization, alert levels.
   * Combines live Redis metrics with today's PostgreSQL snapshot.
   * Sorted: red alerts first, then yellow, then green.
   */
  @Get('resource-monitor')
  @SkipTenantRateLimit()
  async getResourceMonitorOverview() {
    return this.adminService.getResourceMonitorOverview();
  }

  /**
   * GET /api/v1/admin/resource-monitor/alerts
   * Quick list of tenants at 70%+ utilization on any resource limit.
   */
  @Get('resource-monitor/alerts')
  @SkipTenantRateLimit()
  async getResourceAlerts() {
    return this.adminService.getResourceAlerts();
  }

  /**
   * GET /api/v1/admin/tenants/:id/resource-history
   * Daily snapshot history for a specific tenant (for trend charts).
   * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), limit (default 30)
   */
  @Get('tenants/:id/resource-history')
  @SkipTenantRateLimit()
  async getTenantResourceHistory(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.getTenantResourceHistory(id, { from, to, limit: limit! });
  }

  /**
   * GET /api/v1/admin/tenants/:id/live-metrics
   * Real-time Redis metrics for a single tenant (current RPM, today's calls, etc.).
   */
  @Get('tenants/:id/live-metrics')
  @SkipTenantRateLimit()
  async getTenantLiveMetrics(@Param('id') id: string) {
    return this.adminService.getTenantLiveMetrics(id);
  }
}
