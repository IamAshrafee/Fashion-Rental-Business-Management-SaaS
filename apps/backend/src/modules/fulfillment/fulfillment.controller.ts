/**
 * Fulfillment Controller — P09 Order Fulfillment & Logistics
 *
 * Owner-facing REST endpoints for shipping, tracking, and rate calculation.
 * All endpoints require JWT + Tenant + Roles guards.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service';
import { ShipOrderDto, CalculateRateDto } from './dto/fulfillment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

@Controller('owner/fulfillment')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  /**
   * POST /api/v1/owner/fulfillment/:bookingId/ship
   *
   * Ships an order:
   * - If dto.useApi = true → calls courier API (Pathao/Steadfast) to create parcel
   * - If dto.useApi = false or provider = 'manual' → marks shipped with optional manual tracking number
   *
   * Booking must be in "confirmed" state.
   */
  @Post(':bookingId/ship')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async shipOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Body() dto: ShipOrderDto,
  ) {
    return this.fulfillmentService.shipOrder(tenant.id, bookingId, dto);
  }

  /**
   * GET /api/v1/owner/fulfillment/:bookingId/track
   *
   * Fetches live tracking status from the courier API for a shipped order.
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
}
