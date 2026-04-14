/**
 * Fulfillment Controller — Order Fulfillment & Logistics
 *
 * Owner-facing REST endpoints for the delivery lifecycle:
 * - Send pickup requests (auto or manual)
 * - Update delivery stages manually
 * - Track orders via courier API
 * - Calculate shipping rates
 * - Delivery dashboard
 *
 * All endpoints require JWT + Tenant + Roles guards.
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service';
import { ShipOrderDto, CalculateRateDto, UpdateDeliveryStageDto } from './dto/fulfillment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';
import type { DeliveryStageGroup } from './providers/courier-provider.interface';

@Controller('owner/fulfillment')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  /**
   * POST /api/v1/owner/fulfillment/:bookingId/send-pickup
   *
   * Manually sends a pickup request to the courier immediately.
   * Skips the scheduled wait — moves delivery from 'prepare_parcel' to 'awaiting_pickup'.
   *
   * If dto.useApi = true → calls courier API (Pathao/Steadfast) to create parcel
   * If dto.useApi = false or provider = 'manual' → marks with optional tracking number
   *
   * Booking must be in "confirmed" state with delivery stage 'prepare_parcel' or 'error'.
   */
  @Post(':bookingId/send-pickup')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async sendPickupNow(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Body() dto: ShipOrderDto,
  ) {
    return this.fulfillmentService.sendPickupNow(tenant.id, bookingId, dto);
  }

  /**
   * PATCH /api/v1/owner/fulfillment/:bookingId/stage
   *
   * Manually update the delivery stage for a booking.
   * Supports all transitions including error recovery.
   *
   * Allowed stages: prepare_parcel, awaiting_pickup, in_transit, delivered, error
   *
   * When stage = 'delivered', also transitions booking status to delivered.
   * When stage = 'error', a reason should be provided.
   */
  @Patch(':bookingId/stage')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async updateDeliveryStage(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateDeliveryStageDto,
  ) {
    return this.fulfillmentService.updateDeliveryStage(tenant.id, bookingId, dto);
  }

  /**
   * GET /api/v1/owner/fulfillment/:bookingId/track
   *
   * Fetches live tracking status from the courier API.
   * Returns 'unknown' status for manual shipments.
   */
  @Get(':bookingId/track')
  @Roles('owner', 'manager', 'staff')
  async trackOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
  ) {
    return this.fulfillmentService.trackOrder(tenant.id, bookingId);
  }

  /**
   * POST /api/v1/owner/fulfillment/rate
   *
   * Calculates estimated shipping rate between pickup and delivery cities.
   * Returns null for providers that don't support rate calculation.
   */
  @Post('rate')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async calculateRate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CalculateRateDto,
  ) {
    const rate = await this.fulfillmentService.calculateShippingRate(tenant.id, dto);
    if (!rate) {
      return {
        available: false,
        message: `${dto.courierProvider} does not support automatic rate calculation. Set the shipping fee manually.`,
      };
    }
    return { available: true, ...rate };
  }

  /**
   * GET /api/v1/owner/fulfillment/deliveries
   *
   * Returns delivery management dashboard data:
   * - Summary counts grouped by delivery stage (5 groups)
   * - Raw courier status counts
   * - Paginated list of deliveries
   *
   * Optional query params:
   *   ?stage=prepare_parcel (filter by stage group)
   *   ?courierStatus=pickup_pending,in_transit (filter by granular status)
   *   &page=1&limit=20
   */
  @Get('deliveries')
  @Roles('owner', 'manager', 'staff')
  async getDeliveries(
    @CurrentTenant() tenant: TenantContext,
    @Query('stage') stage?: string,
    @Query('courierStatus') courierStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fulfillmentService.getDeliveryDashboard(tenant.id, {
      stage: stage as DeliveryStageGroup | undefined,
      courierStatus: courierStatus?.split(',').filter(Boolean),
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
