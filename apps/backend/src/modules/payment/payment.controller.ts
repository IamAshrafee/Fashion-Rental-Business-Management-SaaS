import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import {
  RecordPaymentDto,
  InitiatePaymentDto,
  ReviewPaymentClaimDto,
  SettleDepositDto,
} from './dto/payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

// ============================================================================
// GUEST CONTROLLER — SSLCommerz endpoints (public)
// ============================================================================

/**
 * Guest-facing payment endpoints.
 * SSLCommerz init, IPN webhook, and redirect handlers.
 */
@Controller('payments')
export class PaymentGuestController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /api/v1/payments/initiate
   * Initiates an SSLCommerz payment session for a booking.
   */
  @Public()
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiatePayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: InitiatePaymentDto,
  ) {
    const result = await this.paymentService.initiateSslcommerz(
      tenant.id,
      dto.bookingId,
      dto.trackingToken,
    );
    return {
      success: true,
      data: {
        paymentUrl: result.paymentUrl,
        sessionKey: result.sessionKey,
      },
    };
  }

  /**
   * POST /api/v1/payments/sslcommerz/ipn
   * SSLCommerz IPN (Instant Payment Notification) webhook.
   * Called server-to-server by SSLCommerz after payment.
   */
  @Public()
  @Post('sslcommerz/ipn')
  @HttpCode(HttpStatus.OK)
  async handleIpn(@Body() body: Record<string, string>) {
    await this.paymentService.handleSslcommerzIpn(body);
    return { status: 'received' };
  }

  /**
   * GET /api/v1/payments/sslcommerz/success
   * Redirect URL after successful SSLCommerz payment.
   * Looks up the booking from tran_id and redirects with bookingNumber.
   */
  @Public()
  @Get('sslcommerz/success')
  async handleSuccess(
    @Query('tran_id') transactionId: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );

    // Extract booking ID from tran_id format: BOOKING-{id}-{timestamp}
    const bookingId = transactionId?.split('-').slice(1, -1).join('-') ?? '';

    // Look up the booking number for the redirect
    let bookingNumber = '';
    let trackingToken = '';
    try {
      const booking = await this.paymentService.getBookingNumber(bookingId);
      bookingNumber = booking?.bookingNumber || bookingId;
      trackingToken = booking?.publicTrackingToken || '';
    } catch {
      bookingNumber = bookingId;
    }

    return res.redirect(
      `${frontendUrl}/booking/confirmation?number=${encodeURIComponent(bookingNumber)}&token=${encodeURIComponent(trackingToken)}&payment=success`,
    );
  }

  /**
   * GET /api/v1/payments/sslcommerz/fail
   * Redirect URL after failed SSLCommerz payment.
   */
  @Public()
  @Get('sslcommerz/fail')
  handleFail(
    @Query('tran_id') transactionId: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );
    return res.redirect(
      `${frontendUrl}/checkout?payment=failed&tran_id=${encodeURIComponent(transactionId || '')}`,
    );
  }

  /**
   * GET /api/v1/payments/sslcommerz/cancel
   * Redirect URL after cancelled SSLCommerz payment.
   */
  @Public()
  @Get('sslcommerz/cancel')
  handleCancel(@Res() res: Response) {
    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );
    return res.redirect(`${frontendUrl}/cart?payment=cancelled`);
  }
}

// ============================================================================
// OWNER CONTROLLER — Authenticated payment management
// ============================================================================

/**
 * Owner-facing payment management endpoints.
 * Record payments, list payment history, manage deposits.
 */
@Controller('owner/bookings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PaymentOwnerController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /api/v1/owner/bookings/:id/payments
   * Record a manual payment (COD, bKash, Nagad).
   */
  @Post(':id/payments')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingId: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: Request & { user?: { id: string } },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const recordedBy = req.user?.id ?? 'unknown';
    const payment = await this.paymentService.recordPayment(
      tenant.id,
      bookingId,
      dto,
      recordedBy,
      idempotencyKey,
    );
    return { success: true, data: payment };
  }

  /**
   * GET /api/v1/owner/bookings/:id/payments
   * List all payments for a booking with summary.
   */
  @Get(':id/payments')
  @Roles('owner', 'manager', 'staff')
  async listPayments(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingId: string,
  ) {
    const result = await this.paymentService.getPaymentsForBooking(
      tenant.id,
      bookingId,
    );
    return { success: true, ...result };
  }

  @Patch(':id/payments/:paymentId/review')
  @Roles('owner', 'manager')
  async reviewPaymentClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: ReviewPaymentClaimDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    const payment = await this.paymentService.reviewPaymentClaim(
      tenant.id,
      bookingId,
      paymentId,
      dto,
      req.user?.id ?? 'unknown',
    );
    return { success: true, data: payment };
  }
}

// ============================================================================
// DEPOSIT CONTROLLER — Authenticated deposit management
// ============================================================================

/**
 * Owner-facing deposit lifecycle management endpoints.
 */
@Controller('owner/booking-items')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DepositController {
  constructor(private readonly paymentService: PaymentService) {}

  /** Atomically closes one item's held deposit with an auditable decision. */
  @Patch(':id/deposit/settle')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async settleDeposit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingItemId: string,
    @Body() dto: SettleDepositDto,
    @Req() req: Request & { user?: { id: string } },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.paymentService.settleDeposit(
      tenant.id,
      bookingItemId,
      dto,
      req.user!.id,
      idempotencyKey,
    );
    return { success: true, data: result };
  }
}
