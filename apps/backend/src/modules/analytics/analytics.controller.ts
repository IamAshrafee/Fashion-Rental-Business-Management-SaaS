import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, RevenueChartQueryDto, TopProductsQueryDto } from './dto/analytics.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

@Controller('owner/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'manager')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSummary(tenant.id, query);
  }

  @Get('revenue')
  async getRevenueSeries(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: RevenueChartQueryDto,
  ) {
    return this.analyticsService.getRevenueSeries(tenant.id, query);
  }

  @Get('revenue-by-category')
  async getRevenueByCategory(
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.analyticsService.getRevenueByCategory(tenant.id);
  }

  @Get('top-products')
  async getTopProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.analyticsService.getTopProducts(tenant.id, query);
  }

  @Get('target-recovery')
  async getTargetRecovery(
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.analyticsService.getTargetRecovery(tenant.id);
  }

  @Get('export/:type')
  async exportCsv() {
    // Basic stub for exporting CSV in v1
    return 'CSV stub';
  }
}
