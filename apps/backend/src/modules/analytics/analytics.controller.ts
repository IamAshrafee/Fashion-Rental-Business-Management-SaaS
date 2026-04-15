import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, RevenueChartQueryDto, TopProductsQueryDto } from './dto/analytics.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext, StorefrontEventPayload } from '@closetrent/types';
import { Public } from '../../common/decorators/public.decorator';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';
import { StorefrontEventDto } from './dto/storefront-event.dto';

@Controller('analytics')
export class AnalyticsGuestController {
  constructor(@InjectQueue('analytics-events') private readonly eventsQueue: Queue) {}

  @Public()
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async trackEvent(
    @CurrentTenant() tenant: TenantContext,
    @Body() payload: StorefrontEventDto,
    @Req() req: Request,
  ) {
    // Fire and forget!
    await this.eventsQueue.add(
      'track-event',
      {
        ...payload,
        tenantId: tenant.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return { success: true };
  }
}

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

  // ---------------------------------------------------------
  // Storefront Traffic Funnel Analytics Endpoints
  // ---------------------------------------------------------

  @Get('traffic/summary')
  async getStorefrontSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getStorefrontSummary(tenant.id, query);
  }

  @Get('traffic/funnel')
  async getFunnelMetrics(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getFunnelMetrics(tenant.id, query);
  }

  @Get('traffic/top-products')
  async getTopViewedProducts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTopViewedProducts(tenant.id, query);
  }

  @Get('traffic/attribution')
  async getMarketingAttribution(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getMarketingAttribution(tenant.id, query);
  }
}
