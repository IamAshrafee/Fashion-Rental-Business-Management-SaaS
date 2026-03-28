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
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import {
  RecordPaymentDto,
  InitiatePaymentDto,
  RefundDepositDto,
  ForfeitDepositDto,
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
   * Redirects customer to the booking confirmation page.
   */
  @Public()
  @Get('sslcommerz/success')
  handleSuccess(
    @Query('tran_id') transactionId: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );
    // Extract booking ID from tran_id format: BOOKING-{id}-{timestamp}
    const bookingId = transactionId?.split('-').slice(1, -1).join('-') ?? '';
    return res.redirect(`${frontendUrl}/booking/confirmation?id=${bookingId}&payment=success`);
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
    return res.redirect(`${frontendUrl}/checkout?payment=failed`);
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
    return res.redirect(`${frontendUrl}/cart`);
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
  ) {
    const recordedBy = req.user?.id ?? 'unknown';
    const payment = await this.paymentService.recordPayment(
      tenant.id,
      bookingId,
      dto,
      recordedBy,
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

  /**
   * PATCH /api/v1/owner/booking-items/:id/deposit/collect
   * Mark a booking item's deposit as collected.
   */
  @Patch(':id/deposit/collect')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async collectDeposit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingItemId: string,
  ) {
    const result = await this.paymentService.collectDeposit(
      tenant.id,
      bookingItemId,
    );
    return { success: true, data: result };
  }

  /**
   * PATCH /api/v1/owner/booking-items/:id/deposit/refund
   * Process a deposit refund (full or partial).
   */
  @Patch(':id/deposit/refund')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async refundDeposit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingItemId: string,
    @Body() dto: RefundDepositDto,
  ) {
    const result = await this.paymentService.refundDeposit(
      tenant.id,
      bookingItemId,
      dto,
    );
    return { success: true, data: result };
  }

  /**
   * PATCH /api/v1/owner/booking-items/:id/deposit/forfeit
   * Forfeit a deposit entirely (severe damage or loss).
   */
  @Patch(':id/deposit/forfeit')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async forfeitDeposit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') bookingItemId: string,
    @Body() dto: ForfeitDepositDto,
  ) {
    const result = await this.paymentService.forfeitDeposit(
      tenant.id,
      bookingItemId,
      dto,
    );
    return { success: true, data: result };
  }
}
