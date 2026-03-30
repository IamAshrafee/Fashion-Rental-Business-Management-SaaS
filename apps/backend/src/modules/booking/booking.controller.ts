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
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { BookingService } from './booking.service';
import { CustomerService } from '../customer/customer.service';
import {
  CreateBookingDto,
  ValidateCartDto,
  UpdateBookingStatusDto,
  ShipBookingDto,
  CancelBookingDto,
  AddNoteDto,
  CreateDamageReportDto,
  BlockDatesDto,
  BookingQueryDto,
  AvailabilityQueryDto,
  CheckAvailabilityDto,
} from './dto/booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';
import { BookingStatus } from '@prisma/client';

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
    private readonly customerService: CustomerService,
  ) {}

  /**
   * GET /api/v1/products/:productId/availability?month=2026-04
   * Returns blocked dates for a product in a given month.
   */
  @Public()
  @Get('products/:productId/availability')
  async checkAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingService.checkAvailability(tenant.id, productId, query.month);
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
      dto.startDate,
      dto.endDate,
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
  ) {
    return this.bookingService.validateCart(tenant.id, dto);
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
  ) {
    return this.bookingService.createBooking(tenant.id, dto);
  }

  /**
   * GET /api/v1/bookings/:bookingNumber/status
   * Guest order tracking — public, only needs booking number.
   */
  @Public()
  @Get('bookings/:bookingNumber/status')
  async getOrderStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingNumber') bookingNumber: string,
  ) {
    return this.bookingService.getBookingByNumber(tenant.id, bookingNumber);
  }

  /**
   * GET /api/v1/customers/lookup?phone=01712345678
   * Public customer lookup for checkout auto-fill.
   * Returns minimal customer info (name, address) — no sensitive data.
   */
  @Public()
  @Get('customers/lookup')
  async lookupCustomer(
    @CurrentTenant() tenant: TenantContext,
    @Query('phone') phone: string,
  ) {
    return this.customerService.lookupByPhone(tenant.id, phone);
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
export class BookingOwnerController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * GET /api/v1/owner/bookings/stats
   * Dashboard stats: pending count, today's deliveries, overdue.
   */
  @Get('stats')
  @Roles('owner', 'manager', 'staff')
  async getStats(@CurrentTenant() tenant: TenantContext) {
    return this.bookingService.getBookingStats(tenant.id);
  }

  /**
   * GET /api/v1/owner/bookings
   * Paginated booking list with filters.
   */
  @Get()
  @Roles('owner', 'manager', 'staff')
  async listBookings(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingService.getBookingList(tenant.id, query);
  }

  /**
   * GET /api/v1/owner/bookings/:id
   * Full booking detail with items, customer, payments.
   */
  @Get(':id')
  @Roles('owner', 'manager', 'staff')
  async getBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.getBookingById(tenant.id, id);
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/status
   * Status transition (general purpose).
   */
  @Patch(':id/status')
  @Roles('owner', 'manager', 'staff')
  async updateStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingService.updateStatus(
      tenant.id,
      id,
      dto.status as BookingStatus,
    );
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/confirm
   * Confirm a pending booking.
   */
  @Patch(':id/confirm')
  @Roles('owner', 'manager')
  async confirmBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.updateStatus(tenant.id, id, 'confirmed');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/ship
   * Mark booking as shipped (with optional courier details).
   */
  @Patch(':id/ship')
  @Roles('owner', 'manager', 'staff')
  async shipBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ShipBookingDto,
  ) {
    return this.bookingService.shipBooking(tenant.id, id, dto);
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/deliver
   * Mark booking as delivered.
   */
  @Patch(':id/deliver')
  @Roles('owner', 'manager', 'staff')
  async deliverBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.updateStatus(tenant.id, id, 'delivered');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/return
   * Mark booking as returned.
   */
  @Patch(':id/return')
  @Roles('owner', 'manager', 'staff')
  async returnBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.updateStatus(tenant.id, id, 'returned');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/inspect
   * Mark booking as inspected (after return).
   */
  @Patch(':id/inspect')
  @Roles('owner', 'manager')
  async inspectBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.updateStatus(tenant.id, id, 'inspected');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/complete
   * Mark booking as completed (deposits processed).
   */
  @Patch(':id/complete')
  @Roles('owner', 'manager')
  async completeBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.updateStatus(tenant.id, id, 'completed');
  }

  /**
   * PATCH /api/v1/owner/bookings/:id/overdue
   * Mark booking as overdue (manual trigger or system).
   */
  @Patch(':id/overdue')
  @Roles('owner', 'manager')
  async markOverdue(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
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
    return this.bookingService.reportDamage(
      tenant.id,
      bookingId,
      itemId,
      dto,
      reportedBy,
    );
  }

  /**
   * POST /api/v1/owner/bookings/:id/late-fees
   * Calculate and update late fees for a booking.
   */
  @Post(':id/late-fees')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.OK)
  async calculateLateFees(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bookingService.calculateLateFees(tenant.id, id);
  }
}

// ============================================================================
// DATE BLOCKS CONTROLLER — Authenticated
// ============================================================================

/**
 * Owner endpoints for managing manual date blocks.
 */
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DateBlockController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * POST /api/v1/owner/products/:productId/date-blocks
   * Manually block dates for a product.
   */
  @Post('owner/products/:productId/date-blocks')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async blockDates(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Body() dto: BlockDatesDto,
  ) {
    // Inject productId from path param into dto
    return this.bookingService.blockDates(tenant.id, { ...dto, productId });
  }

  /**
   * DELETE /api/v1/owner/date-blocks/:blockId
   * Remove a manual date block.
   */
  @Delete('owner/date-blocks/:blockId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async unblockDates(
    @CurrentTenant() tenant: TenantContext,
    @Param('blockId') blockId: string,
  ) {
    return this.bookingService.unblockDates(tenant.id, blockId);
  }
}
