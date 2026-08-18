import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BookingService } from './booking.service';
import {
  CreateBookingDto,
  CreateManualBookingDto,
  CreateManualBookingQuoteDto,
  ValidateCartDto,
  CancelBookingDto,
  AddNoteDto,
  CreateDamageReportDto,
  BookingQueryDto,
  BookingCalendarQueryDto,
  CheckAvailabilityDto,
  ReplaceStorefrontCartDto,
  ApproveAndReserveBookingDto,
  RejectBookingRequestDto,
  RenewBookingHoldDto,
  CompleteFulfillmentPackingDto,
} from './dto/booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';
import { StorefrontCartService } from './storefront-cart.service';
import { BookingReviewService } from '../operations/booking-review.service';
import { FulfillmentPreparationService } from '../operations/fulfillment-preparation.service';

// ============================================================================
// GUEST CONTROLLER — Public endpoints
// ============================================================================

/**
 * Guest-facing booking endpoints.
 * All are @Public() — no authentication required.
 */
@Controller()
export class BookingGuestController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly storefrontCartService: StorefrontCartService,
  ) {}

  @Public()
  @Get('storefront/cart')
  async getCart(@CurrentTenant() tenant: TenantContext, @Req() req: Request) {
    return this.storefrontCartService.get(
      tenant.id,
      req.cookies?.[StorefrontCartService.cookieName],
    );
  }

  @Public()
  @Put('storefront/cart')
  async replaceCart(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ReplaceStorefrontCartDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.storefrontCartService.replace(
      tenant.id,
      req.cookies?.[StorefrontCartService.cookieName],
      dto.items,
    );
    if (result.issuedToken) {
      res.cookie(StorefrontCartService.cookieName, result.issuedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }
    return result.cart;
  }

  /**
   * POST /api/v1/products/:productId/check-availability
   * Checks a specific date range and returns pricing.
   */
  @Public()
  @Post('products/:productId/check-availability')
  @HttpCode(HttpStatus.OK)
  async checkDateRange(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Body() dto: CheckAvailabilityDto,
  ) {
    return this.bookingService.checkDateRange(
      tenant.id,
      productId,
      dto.variantSizeId,
      dto.startDate,
      dto.endDate,
      dto.quantity,
    );
  }

  /**
   * POST /api/v1/bookings/validate
   * Validates cart items and returns pricing. Used pre-checkout.
   */
  @Public()
  @Post('bookings/validate')
  @HttpCode(HttpStatus.OK)
  async validateCart(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ValidateCartDto,
    @Req() req: Request,
  ) {
    return this.bookingService.validateCart(
      tenant.id,
      dto,
      req.cookies?.[StorefrontCartService.cookieName],
    );
  }

  /**
   * POST /api/v1/bookings
   * Creates a booking from the checkout form.
   */
  @Public()
  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') creationKey?: string,
    @Req() req?: Request,
  ) {
    return this.bookingService.createGuestBooking(
      tenant.id,
      dto,
      creationKey,
      req?.cookies?.[StorefrontCartService.cookieName],
    );
  }

  /**
   * GET /api/v1/bookings/track/:token
   * Capability URL for guest tracking. The high-entropy token is issued only
   * to the customer who created the booking.
   */
  @Public()
  @Get('bookings/track/:token')
  async getOrderStatus(@CurrentTenant() tenant: TenantContext, @Param('token') token: string) {
    return this.bookingService.getBookingByTrackingToken(tenant.id, token);
  }
}

// ============================================================================
// OWNER CONTROLLER — Authenticated endpoints
// ============================================================================

/**
 * Owner-facing booking management endpoints.
 * Requires JWT + tenant + roles.
 */
@Controller('owner/bookings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@RequirePermission('manage_bookings')
export class BookingOwnerController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingReview: BookingReviewService,
    private readonly preparation: FulfillmentPreparationService,
  ) {}

  @Post('quote')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async createManualQuote(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateManualBookingQuoteDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.bookingService.createManualQuote(tenant.id, dto, req.user?.id);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createManualBooking(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateManualBookingDto,
    @Headers('idempotency-key') creationKey?: string,
    @Req() req?: Request & { user?: { id: string } },
  ) {
    return this.bookingService.createManualBooking(tenant.id, dto, creationKey, req?.user?.id);
  }

  /**
   * GET /api/v1/owner/bookings/stats
   * Dashboard stats: pending count, today's deliveries, overdue.
   */
  @Get('stats')
  @Roles('owner', 'manager', 'staff')
  async getStats(@CurrentTenant() tenant: TenantContext) {
    return this.bookingService.getBookingStats(tenant.id);
  }

  /** Compact, non-truncating projection for the owner rental calendar. */
  @Get('calendar')
  @Roles('owner', 'manager', 'staff')
  async getCalendar(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BookingCalendarQueryDto,
  ) {
    return this.bookingService.getBookingCalendar(tenant.id, query.startDate, query.endDate);
  }

  /**
   * GET /api/v1/owner/bookings
   * Paginated booking list with filters.
   */
  @Get()
  @Roles('owner', 'manager', 'staff')
  async listBookings(@CurrentTenant() tenant: TenantContext, @Query() query: BookingQueryDto) {
    return this.bookingService.getBookingList(tenant.id, query);
  }

  /**
   * GET /api/v1/owner/bookings/:id
   * Full booking detail with items, customer, payments.
   */
  @Get(':id')
  @Roles('owner', 'manager', 'staff')
  async getBooking(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.getBookingById(tenant.id, id);
  }

  /** Atomically approves the current immutable version and reserves exact units. */
  @Post(':id/review/approve-and-reserve')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async approveAndReserve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ApproveAndReserveBookingDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.bookingReview.approveAndReserve(
      this.reviewContext(tenant.id, id, req.user?.id, idempotencyKey),
      dto,
    );
  }

  @Post(':id/review/reject')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async rejectRequest(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RejectBookingRequestDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.bookingReview.rejectRequest(
      this.reviewContext(tenant.id, id, req.user?.id, idempotencyKey),
      dto,
    );
  }

  @Post(':id/review/renew-hold')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async renewHold(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RenewBookingHoldDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.bookingReview.renewHold(
      this.reviewContext(tenant.id, id, req.user?.id, idempotencyKey),
      dto,
    );
  }

  @Post(':id/fulfillment-groups/:groupId/packing/complete')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async completePacking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CompleteFulfillmentPackingDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request & { user?: { id: string } },
  ) {
    const command = this.reviewContext(tenant.id, bookingId, req.user?.id, idempotencyKey);
    return this.preparation.completePacking({ ...command, groupId }, dto);
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/deliver
   * Mark booking as delivered (manual fallback — normally triggered by delivery module).
   */
  @Patch(':id/deliver')
  @Roles('owner', 'manager', 'staff')
  async deliverBooking(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.updateStatus(tenant.id, id, 'delivered');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/return
   * Mark booking as returned.
   */
  @Patch(':id/return')
  @Roles('owner', 'manager', 'staff')
  async returnBooking(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.updateStatus(tenant.id, id, 'returned');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/inspect
   * Mark booking as inspected (after return).
   */
  @Patch(':id/inspect')
  @Roles('owner', 'manager')
  async inspectBooking(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.updateStatus(tenant.id, id, 'inspected');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/complete
   * Mark booking as completed (deposits processed).
   */
  @Patch(':id/complete')
  @Roles('owner', 'manager')
  async completeBooking(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.updateStatus(tenant.id, id, 'completed');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/overdue
   * Mark booking as overdue (manual trigger or system).
   */
  @Patch(':id/overdue')
  @Roles('owner', 'manager')
  async markOverdue(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.updateStatus(tenant.id, id, 'overdue');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/cancel
   * Cancel a booking (owner). Requires cancellation reason.
   */
  @Patch(':id/cancel')
  @Roles('owner', 'manager')
  async cancelBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingService.cancelBooking(tenant.id, id, dto, 'owner');
  }

  /**
   * POST /api/v1/owner/bookings/:id/notes
   * Add an internal note to a booking.
   */
  @Post(':id/notes')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async addNote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.bookingService.addNote(tenant.id, id, dto.note);
  }

  private reviewContext(
    tenantId: string,
    bookingId: string,
    actorUserId: string | undefined,
    idempotencyKey: string | undefined,
  ) {
    if (!actorUserId) {
      throw new BadRequestException('An authenticated review actor is required');
    }
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'An Idempotency-Key header is required for booking review commands',
      });
    }
    return { tenantId, bookingId, actorUserId, idempotencyKey: idempotencyKey.trim() };
  }

  /**
   * POST /api/v1/owner/bookings/:id/items/:itemId/damage
   * Report damage on a returned item.
   */
  @Post(':id/items/:itemId/damage')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async reportDamage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateDamageReportDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    const reportedBy = req.user?.id ?? 'unknown';
    return this.bookingService.reportDamage(tenant.id, bookingId, itemId, dto, reportedBy);
  }

  /**
   * POST /api/v1/owner/bookings/:id/late-fees
   * Calculate and update late fees for a booking.
   */
  @Post(':id/late-fees')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async calculateLateFees(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.bookingService.calculateLateFees(tenant.id, id);
  }
}
