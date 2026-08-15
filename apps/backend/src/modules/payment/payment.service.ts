import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentMethod,
  PaymentStatus,
  TransactionStatus,
  Prisma,
} from '@prisma/client';
import {
  RecordPaymentDto,
  ReviewPaymentClaimDto,
  SettleDepositDto,
} from './dto/payment.dto';
import { createHash } from 'crypto';
import { SensitiveDataService } from '../../common/security/sensitive-data.service';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PaymentSummary {
  totalDue: number;
  totalPaid: number;
  balance: number;
  paymentStatus: string;
  rentalPaid: number;
  depositPaid: number;
}

interface SslcommerzInitResult {
  paymentUrl: string;
  sessionKey: string;
  transactionId: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly sensitiveData: SensitiveDataService,
  ) {}

  // =========================================================================
  // PAYMENT RECORDING
  // =========================================================================

  /**
   * Records a manual payment (COD, bKash, Nagad).
   * Creates a Payment record, updates booking.totalPaid and paymentStatus.
   * All inside a transaction to prevent race conditions.
   */
  async recordPayment(
    tenantId: string,
    bookingId: string,
    dto: RecordPaymentDto,
    recordedBy: string,
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = rawIdempotencyKey?.trim();
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key is required when recording a payment');
    if (idempotencyKey.length > 200) throw new BadRequestException('Idempotency-Key cannot exceed 200 characters');
    const transactionId = dto.transactionId?.trim() || null;
    const notes = dto.notes?.trim() || null;
    const requestHash = createHash('sha256').update(JSON.stringify({
      bookingId,
      amount: dto.amount,
      depositAmount: dto.depositAmount ?? 0,
      method: dto.method,
      transactionId,
      notes,
    })).digest('hex');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM bookings
        WHERE tenant_id = ${tenantId} AND id = ${bookingId}
        FOR UPDATE
      `);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId, deletedAt: null },
      });
      if (!booking) throw new NotFoundException('Booking not found');

      const replay = await tx.payment.findFirst({ where: { tenantId, idempotencyKey } });
      if (replay) {
        if (replay.bookingId !== bookingId || replay.requestHash !== requestHash) {
          throw new ConflictException({ code: 'PAYMENT_IDEMPOTENCY_REUSED', message: 'This payment key belongs to another request' });
        }
        return { payment: replay, bookingNumber: booking.bookingNumber, replayed: true };
      }

      const paid = await tx.payment.aggregate({
        where: { tenantId, bookingId, status: 'verified' },
        _sum: { amount: true, rentalAmount: true, depositAmount: true },
      });
      const alreadyPaid = paid._sum.amount ?? 0;
      const remaining = booking.grandTotal - alreadyPaid;
      if (dto.amount > remaining) {
        throw new ConflictException({
          code: 'PAYMENT_EXCEEDS_BALANCE',
          message: `Payment amount (${dto.amount}) exceeds remaining balance (${remaining})`,
          remainingBalance: remaining,
        });
      }
      const depositAmount = dto.depositAmount ?? 0;
      if (depositAmount > dto.amount) throw new BadRequestException('Deposit allocation cannot exceed the payment amount');
      const remainingDeposit = booking.totalDeposit - (paid._sum.depositAmount ?? 0);
      if (depositAmount > remainingDeposit) {
        throw new ConflictException({
          code: 'DEPOSIT_ALLOCATION_EXCEEDS_BALANCE',
          message: `Deposit allocation (${depositAmount}) exceeds uncollected deposits (${remainingDeposit})`,
          remainingDeposit,
        });
      }
      const rentalAmount = dto.amount - depositAmount;
      const remainingRental = booking.grandTotal - booking.totalDeposit - (paid._sum.rentalAmount ?? 0);
      if (rentalAmount > remainingRental) {
        throw new ConflictException({
          code: 'RENTAL_ALLOCATION_EXCEEDS_BALANCE',
          message: `Rental allocation (${rentalAmount}) exceeds remaining rental charges (${remainingRental})`,
          remainingRental,
        });
      }
      if (transactionId) {
        const duplicate = await tx.payment.findFirst({ where: { tenantId, transactionId } });
        if (duplicate) throw new ConflictException({ code: 'PAYMENT_TRANSACTION_DUPLICATE', message: `Transaction ID "${transactionId}" is already recorded` });
      }

      // Create payment record (manual payments are immediately verified)
      const payment = await tx.payment.create({
        data: {
          tenantId,
          bookingId,
          idempotencyKey,
          requestHash,
          amount: dto.amount,
          rentalAmount,
          depositAmount,
          method: dto.method as PaymentMethod,
          status: 'verified' as TransactionStatus,
          transactionId,
          notes,
          recordedBy,
          verifiedAt: new Date(),
        },
      });

      // Update booking totalPaid
      const newTotalPaid = alreadyPaid + dto.amount;

      // Calculate payment status
      const paymentStatus = this.calculatePaymentStatus(
        newTotalPaid,
        booking.grandTotal,
      );

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          totalPaid: newTotalPaid,
          paymentStatus: paymentStatus as PaymentStatus,
        },
      });
      await this.updateDepositProjection(
        tx,
        tenantId,
        bookingId,
        booking.totalDeposit,
        (paid._sum.depositAmount ?? 0) + depositAmount,
      );

      return { payment, bookingNumber: booking.bookingNumber, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    // Emit event (ADR-05)
    if (!result.replayed) {
      this.eventEmitter.emit('payment.received', {
        tenantId,
        bookingId,
        paymentId: result.payment.id,
        amount: result.payment.amount,
        rentalAmount: result.payment.rentalAmount,
        depositAmount: result.payment.depositAmount,
        method: result.payment.method,
        bookingNumber: result.bookingNumber,
      });
    }

    this.logger.log(
      `Payment ${result.replayed ? 'replayed' : 'recorded'}: ${dto.amount} minor BDT via ${dto.method} for booking ${result.bookingNumber}`,
    );

    return result.payment;
  }

  async reviewPaymentClaim(
    tenantId: string,
    bookingId: string,
    paymentId: string,
    dto: ReviewPaymentClaimDto,
    actorUserId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM bookings WHERE tenant_id = ${tenantId} AND id = ${bookingId} FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM payments WHERE tenant_id = ${tenantId} AND id = ${paymentId} FOR UPDATE
      `);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId, deletedAt: null },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      const claim = await tx.payment.findFirst({
        where: { id: paymentId, bookingId, tenantId },
      });
      if (!claim) throw new NotFoundException('Payment claim not found');
      if (!['bkash', 'nagad'].includes(claim.method)) {
        throw new BadRequestException('Only customer-submitted mobile-payment claims can be reviewed here');
      }
      if (claim.status !== 'pending') {
        throw new ConflictException({ code: 'PAYMENT_CLAIM_ALREADY_REVIEWED', message: 'This payment claim has already been reviewed' });
      }

      const reviewedAt = new Date();
      if (!dto.approve) {
        const payment = await tx.payment.update({
          where: { id: claim.id },
          data: {
            status: 'failed',
            recordedBy: actorUserId,
            notes: dto.reason?.trim() || 'Customer payment claim rejected',
            providerResponse: {
              review: { approved: false, reviewedAt: reviewedAt.toISOString(), actorUserId },
            },
          },
        });
        return { payment, bookingNumber: booking.bookingNumber, approved: false };
      }

      const verified = await tx.payment.aggregate({
        where: { tenantId, bookingId, status: 'verified' },
        _sum: { amount: true, depositAmount: true },
      });
      const alreadyPaid = verified._sum.amount ?? 0;
      if (claim.amount > booking.grandTotal - alreadyPaid) {
        throw new ConflictException({
          code: 'PAYMENT_CLAIM_EXCEEDS_BALANCE',
          message: 'The claimed amount exceeds the remaining booking balance',
          remainingBalance: booking.grandTotal - alreadyPaid,
        });
      }
      const payment = await tx.payment.update({
        where: { id: claim.id },
        data: {
          status: 'verified',
          recordedBy: actorUserId,
          verifiedAt: reviewedAt,
          notes: dto.reason?.trim() || 'Customer payment claim verified',
          providerResponse: {
            review: { approved: true, reviewedAt: reviewedAt.toISOString(), actorUserId },
          },
        },
      });
      const newTotalPaid = alreadyPaid + claim.amount;
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          totalPaid: newTotalPaid,
          paymentStatus: this.calculatePaymentStatus(newTotalPaid, booking.grandTotal) as PaymentStatus,
        },
      });
      await this.updateDepositProjection(
        tx,
        tenantId,
        bookingId,
        booking.totalDeposit,
        (verified._sum.depositAmount ?? 0) + claim.depositAmount,
      );
      return { payment, bookingNumber: booking.bookingNumber, approved: true };
    });

    if (result.approved) {
      this.eventEmitter.emit('payment.received', {
        tenantId,
        bookingId,
        paymentId: result.payment.id,
        amount: result.payment.amount,
        rentalAmount: result.payment.rentalAmount,
        depositAmount: result.payment.depositAmount,
        method: result.payment.method,
        bookingNumber: result.bookingNumber,
      });
    }
    return result.payment;
  }

  // =========================================================================
  // PAYMENT QUERIES
  // =========================================================================

  /**
   * Lists all payments for a booking, plus summary (totalDue, totalPaid, balance).
   */
  async getPaymentsForBooking(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      select: {
        id: true,
        grandTotal: true,
        totalDeposit: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payments = await this.prisma.payment.findMany({
      where: { bookingId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        rentalAmount: true,
        depositAmount: true,
        method: true,
        status: true,
        transactionId: true,
        notes: true,
        recordedBy: true,
        verifiedAt: true,
        refundedAt: true,
        refundAmount: true,
        createdAt: true,
      },
    });

    const verifiedPayments = payments.filter((payment) => payment.status === 'verified');
    const ledgerTotalPaid = verifiedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const summary: PaymentSummary = {
      totalDue: booking.grandTotal,
      totalPaid: ledgerTotalPaid,
      balance: booking.grandTotal - ledgerTotalPaid,
      paymentStatus: this.calculatePaymentStatus(ledgerTotalPaid, booking.grandTotal),
      rentalPaid: verifiedPayments.reduce((sum, payment) => sum + payment.rentalAmount, 0),
      depositPaid: verifiedPayments.reduce((sum, payment) => sum + payment.depositAmount, 0),
    };

    return { data: payments, summary };
  }

  // =========================================================================
  // SSLCOMMERZ INTEGRATION
  // =========================================================================

  /**
   * Initiates an SSLCommerz payment session.
   * Returns the gateway URL for customer redirect.
   */
  async initiateSslcommerz(
    tenantId: string,
    bookingId: string,
    trackingToken: string,
  ): Promise<SslcommerzInitResult> {
    // Load booking + tenant's store settings
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, publicTrackingToken: trackingToken, deletedAt: null },
      select: {
        id: true,
        bookingNumber: true,
        grandTotal: true,
        totalPaid: true,
        totalDeposit: true,
        paymentMethod: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddressLine1: true,
        deliveryCity: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.paymentMethod !== 'sslcommerz') {
      throw new BadRequestException('This booking was not created for online card payment');
    }

    const paid = await this.prisma.payment.aggregate({
      where: { tenantId, bookingId, status: 'verified' },
      _sum: { amount: true, rentalAmount: true, depositAmount: true },
    });
    const remainingAmount = booking.grandTotal - (paid._sum.amount ?? 0);
    if (remainingAmount <= 0) {
      throw new UnprocessableEntityException('Booking is already fully paid');
    }

    const storeSettings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        sslcommerzStoreId: true,
        sslcommerzStorePass: true,
        sslcommerzSandbox: true,
        currencyCode: true,
      },
    });

    if (!storeSettings?.sslcommerzStoreId || !storeSettings?.sslcommerzStorePass) {
      throw new UnprocessableEntityException(
        'SSLCommerz is not configured for this store. Please set up SSLCommerz credentials in Store Settings.',
      );
    }

    // Generate a unique transaction ID
    const transactionId = `BOOKING-${booking.id}-${Date.now()}`;
    const existingPending = await this.prisma.payment.findFirst({
      where: { tenantId, bookingId, method: 'sslcommerz', status: 'pending' },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException({ code: 'PAYMENT_SESSION_PENDING', message: 'A payment session is already pending for this booking' });
    }
    const depositAmount = Math.max(0, booking.totalDeposit - (paid._sum.depositAmount ?? 0));
    const rentalAmount = remainingAmount - depositAmount;
    if (rentalAmount < 0) {
      throw new ConflictException({ code: 'PAYMENT_ALLOCATION_INCONSISTENT', message: 'Payment allocations exceed the remaining booking balance' });
    }

    // Build SSLCommerz init payload
    const baseUrl = this.configService.get<string>('app.backendUrl', 'http://localhost:4000');


    const storePassword = this.sensitiveData.decrypt(storeSettings.sslcommerzStorePass);
    const payload = new URLSearchParams({
      store_id: storeSettings.sslcommerzStoreId,
      store_passwd: storePassword,
      total_amount: (remainingAmount / 100).toFixed(2),
      currency: storeSettings.currencyCode || 'BDT',
      tran_id: transactionId,
      success_url: `${baseUrl}/api/v1/payments/sslcommerz/success`,
      fail_url: `${baseUrl}/api/v1/payments/sslcommerz/fail`,
      cancel_url: `${baseUrl}/api/v1/payments/sslcommerz/cancel`,
      ipn_url: `${baseUrl}/api/v1/payments/sslcommerz/ipn`,
      cus_name: booking.deliveryName,
      cus_phone: booking.deliveryPhone,
      cus_email: 'N/A',
      cus_add1: booking.deliveryAddressLine1,
      cus_city: booking.deliveryCity,
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      product_name: `Booking ${booking.bookingNumber}`,
      product_category: 'Rental',
      product_profile: 'non-physical-goods',
    });

    // Determine SSLCommerz API URL
    const sslBaseUrl = storeSettings.sslcommerzSandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';

    // Create a pending payment record to track the transaction
    await this.prisma.payment.create({
      data: {
        tenantId,
        bookingId: booking.id,
        idempotencyKey: `ssl:${transactionId}`,
        requestHash: createHash('sha256').update(`${booking.id}:${remainingAmount}`).digest('hex'),
        amount: remainingAmount,
        rentalAmount,
        depositAmount,
        method: 'sslcommerz' as PaymentMethod,
        status: 'pending' as TransactionStatus,
        transactionId,
      },
    });

    try {
      const response = await fetch(`${sslBaseUrl}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
      });

      const data = (await response.json()) as Record<string, string>;

      if (data.status !== 'SUCCESS') {
        // Cleanup the pending payment
        await this.prisma.payment.deleteMany({
          where: { transactionId, status: 'pending' },
        });
        throw new UnprocessableEntityException(
          `SSLCommerz session init failed: ${data.failedreason || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `SSLCommerz session initiated for booking ${booking.bookingNumber}, tran_id: ${transactionId}`,
      );

      return {
        paymentUrl: data.GatewayPageURL,
        sessionKey: data.sessionkey,
        transactionId,
      };
    } catch (error) {
      // Cleanup on fetch failure
      await this.prisma.payment.deleteMany({
        where: { transactionId, status: 'pending' },
      });
      if (error instanceof UnprocessableEntityException) throw error;
      this.logger.error(`SSLCommerz init failed: ${error}`);
      throw new UnprocessableEntityException(
        'Failed to connect to SSLCommerz. Please try again later.',
      );
    }
  }

  /**
   * Handles SSLCommerz IPN (Instant Payment Notification).
   * Verifies the payment and updates booking status.
   */
  async handleSslcommerzIpn(ipnPayload: Record<string, string>): Promise<void> {
    const {
      tran_id: transactionId,
      status,
      amount,
      store_id: storeId,
      val_id: validationId,
      verify_sign: _verifySign,
    } = ipnPayload;

    if (!transactionId || !status || ((status === 'VALID' || status === 'VALIDATED') && !validationId)) {
      this.logger.warn('Invalid IPN payload — missing required transaction fields');
      return;
    }

    // Find the pending payment
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId, status: 'pending' },
      include: {
        booking: {
          select: {
            id: true,
            tenantId: true,
            bookingNumber: true,
            grandTotal: true,
            totalPaid: true,
            totalDeposit: true,
          },
        },
      },
    });

    if (!payment) {
      this.logger.warn(`IPN for unknown or already-processed tran_id: ${transactionId}`);
      return;
    }

    const booking = payment.booking;

    // Verify store_id matches tenant config
    const storeSettings = await this.prisma.storeSettings.findUnique({
      where: { tenantId: booking.tenantId },
      select: {
        sslcommerzStoreId: true,
        sslcommerzStorePass: true,
        sslcommerzSandbox: true,
      },
    });

    if (
      !storeSettings?.sslcommerzStoreId
      || !storeSettings.sslcommerzStorePass
      || storeSettings.sslcommerzStoreId !== storeId
    ) {
      this.logger.warn(
        `IPN store_id mismatch for ${transactionId}: expected ${storeSettings?.sslcommerzStoreId}, got ${storeId}`,
      );
      return;
    }

    if (status === 'VALID' || status === 'VALIDATED') {
      const validation = await this.validateSslcommerzTransaction({
        validationId,
        storeId: storeSettings.sslcommerzStoreId,
        storePassword: this.sensitiveData.decrypt(storeSettings.sslcommerzStorePass),
        sandbox: storeSettings.sslcommerzSandbox,
      });
      if (
        !['VALID', 'VALIDATED'].includes(validation.status)
        || validation.tran_id !== transactionId
        || validation.val_id !== validationId
      ) {
        this.logger.warn(`SSLCommerz validation failed for ${transactionId}`);
        return;
      }
      if (String(validation.risk_level ?? '0') === '1') {
        this.logger.warn(`SSLCommerz marked ${transactionId} as high risk; payment remains pending for manual review`);
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: 'pending' },
          data: { providerResponse: validation as unknown as Prisma.InputJsonValue },
        });
        return;
      }
      // Verify amount matches
      const ipnAmount = Math.round(Number(amount) * 100);
      const validatedAmount = Math.round(Number(validation.amount) * 100);
      if (!Number.isFinite(ipnAmount) || ipnAmount !== payment.amount || validatedAmount !== payment.amount) {
        this.logger.warn(
          `IPN amount mismatch for ${transactionId}: expected ${payment.amount}, got ${ipnAmount}`,
        );
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed' as TransactionStatus,
            providerResponse: ipnPayload as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      // Payment is valid — update in transaction
      const processed = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM payments WHERE id = ${payment.id} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`);
        const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        if (!currentPayment || currentPayment.status !== 'pending') return false;
        await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status: 'verified' as TransactionStatus,
            verifiedAt: new Date(),
            providerResponse: ipnPayload as unknown as Prisma.InputJsonValue,
          },
        });

        const verified = await tx.payment.aggregate({
          where: { tenantId: booking.tenantId, bookingId: booking.id, status: 'verified' },
          _sum: { amount: true, depositAmount: true },
        });
        const newTotalPaid = verified._sum.amount ?? 0;
        const paymentStatus = this.calculatePaymentStatus(
          newTotalPaid,
          booking.grandTotal,
        );

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            totalPaid: newTotalPaid,
            paymentStatus: paymentStatus as PaymentStatus,
          },
        });
        await this.updateDepositProjection(
          tx,
          booking.tenantId,
          booking.id,
          booking.totalDeposit,
          verified._sum.depositAmount ?? 0,
        );
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      if (!processed) return;

      this.eventEmitter.emit('payment.received', {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        paymentId: payment.id,
        amount: payment.amount,
        rentalAmount: payment.rentalAmount,
        depositAmount: payment.depositAmount,
        method: 'sslcommerz',
        bookingNumber: booking.bookingNumber,
      });

      this.logger.log(
        `SSLCommerz payment verified for booking ${booking.bookingNumber}: ${payment.amount} minor BDT`,
      );
    } else {
      // Payment failed or was cancelled
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed' as TransactionStatus,
          providerResponse: ipnPayload as unknown as Prisma.InputJsonValue,
        },
      });

      this.logger.warn(
        `SSLCommerz payment failed for ${transactionId}: status=${status}`,
      );
    }
  }

  private async validateSslcommerzTransaction(input: {
    validationId: string;
    storeId: string;
    storePassword: string;
    sandbox: boolean;
  }): Promise<Record<string, string>> {
    const baseUrl = input.sandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
    const query = new URLSearchParams({
      val_id: input.validationId,
      store_id: input.storeId,
      store_passwd: input.storePassword,
      v: '1',
      format: 'json',
    });
    try {
      const response = await fetch(`${baseUrl}/validator/api/validationserverAPI.php?${query.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as Record<string, string>;
    } catch (error) {
      this.logger.error(`SSLCommerz validation API unavailable: ${error}`);
      throw new UnprocessableEntityException(
        'Payment validation is temporarily unavailable; the notification can be retried safely',
      );
    }
  }

  // =========================================================================
  // DEPOSIT MANAGEMENT
  // =========================================================================

  async settleDeposit(
    tenantId: string,
    bookingItemId: string,
    dto: SettleDepositDto,
    actorUserId: string,
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = rawIdempotencyKey?.trim();
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key is required for deposit settlement');
    if (idempotencyKey.length > 200) throw new BadRequestException('Idempotency-Key cannot exceed 200 characters');
    const requestHash = createHash('sha256').update(JSON.stringify({ bookingItemId, ...dto })).digest('hex');

    const result = await this.prisma.$transaction(async (tx) => {
      const replay = await tx.depositSettlement.findFirst({ where: { tenantId, idempotencyKey } });
      if (replay) {
        if (replay.bookingItemId !== bookingItemId || replay.requestHash !== requestHash) {
          throw new ConflictException({ code: 'DEPOSIT_IDEMPOTENCY_REUSED', message: 'This settlement key belongs to another request' });
        }
        return { settlement: replay, replayed: true };
      }
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM booking_items
        WHERE tenant_id = ${tenantId} AND id = ${bookingItemId}
        FOR UPDATE
      `);
      const item = await tx.bookingItem.findFirst({
        where: { id: bookingItemId, tenantId },
        include: { booking: true, damageReport: true, depositSettlement: true },
      });
      if (!item) throw new NotFoundException('Booking item not found');
      if (item.depositAmount <= 0) throw new UnprocessableEntityException('This item has no security deposit');
      if (item.depositSettlement) {
        throw new ConflictException({ code: 'DEPOSIT_ALREADY_SETTLED', message: 'This item deposit already has a final settlement' });
      }
      if (item.booking.status !== 'inspected') {
        throw new ConflictException({
          code: 'RETURN_INSPECTION_REQUIRED',
          message: 'Complete the booking return and inspection workflow before settling its deposit',
          bookingStatus: item.booking.status,
        });
      }
      const paid = await tx.payment.aggregate({
        where: { tenantId, bookingId: item.bookingId, status: 'verified' },
        _sum: { depositAmount: true },
      });
      const settled = await tx.depositSettlement.aggregate({
        where: { tenantId, bookingId: item.bookingId },
        _sum: { refundAmount: true, deductionAmount: true, forfeitedAmount: true },
      });
      const received = paid._sum.depositAmount ?? 0;
      const previousOutflow = (settled._sum.refundAmount ?? 0) + (settled._sum.deductionAmount ?? 0) + (settled._sum.forfeitedAmount ?? 0);
      const heldBalance = received - previousOutflow;
      if (item.depositStatus !== 'held' || received < item.booking.totalDeposit) {
        throw new ConflictException({
          code: 'DEPOSIT_NOT_FULLY_HELD',
          message: 'Collect the complete booking security deposit through a verified payment before settlement',
          receivedDeposit: received,
          requiredDeposit: item.booking.totalDeposit,
        });
      }
      const refundAmount = dto.forfeit ? 0 : dto.refundAmount;
      const deductionAmount = dto.forfeit ? 0 : dto.deductionAmount;
      const forfeitedAmount = dto.forfeit ? item.depositAmount : 0;
      if (!dto.forfeit && refundAmount + deductionAmount !== item.depositAmount) {
        throw new BadRequestException('Refund and deduction must account for the complete item deposit');
      }
      const depositOutflow = refundAmount + deductionAmount + forfeitedAmount;
      if (depositOutflow > heldBalance) {
        throw new ConflictException({
          code: 'DEPOSIT_SETTLEMENT_EXCEEDS_HELD',
          message: 'Settlement exceeds the currently held deposit balance',
          heldBalance,
        });
      }
      if (dto.damageReportId && item.damageReport?.id !== dto.damageReportId) {
        throw new BadRequestException('Damage evidence does not belong to this booking item');
      }
      const additionalCharge = dto.additionalCharge ?? 0;
      const requiresEvidence = dto.forfeit || deductionAmount > 0 || additionalCharge > 0;
      if (requiresEvidence && (!dto.damageReportId || item.damageReport?.id !== dto.damageReportId)) {
        throw new ConflictException({
          code: 'SETTLEMENT_EVIDENCE_REQUIRED',
          message: 'A linked return damage or loss report is required for deductions, forfeiture, or additional charges',
        });
      }
      const settlement = await tx.depositSettlement.create({
        data: {
          tenantId,
          bookingId: item.bookingId,
          bookingItemId,
          damageReportId: dto.damageReportId ?? null,
          refundAmount,
          deductionAmount,
          forfeitedAmount,
          additionalCharge,
          refundMethod: refundAmount > 0 ? dto.refundMethod : null,
          reason: dto.reason.trim(),
          evidenceSnapshot: item.damageReport ? {
            damageReportId: item.damageReport.id,
            damageLevel: item.damageReport.damageLevel,
            description: item.damageReport.description,
            estimatedRepairCost: item.damageReport.estimatedRepairCost,
            suggestedDeductionAmount: item.damageReport.deductionAmount,
            suggestedAdditionalCharge: item.damageReport.additionalCharge,
            photos: item.damageReport.photos,
          } : Prisma.DbNull,
          idempotencyKey,
          requestHash,
          actorUserId,
        },
      });
      const depositStatus = dto.forfeit
        ? 'forfeited'
        : deductionAmount > 0 ? 'partially_refunded' : 'refunded';
      await tx.bookingItem.update({
        where: { id: bookingItemId },
        data: {
          depositStatus,
          depositRefundAmount: refundAmount,
          depositRefundMethod: refundAmount > 0 ? dto.refundMethod : null,
          depositRefundDate: new Date(),
        },
      });
      if (additionalCharge > 0) {
        const nextGrandTotal = item.booking.grandTotal + additionalCharge;
        await tx.booking.update({
          where: { id: item.bookingId },
          data: {
            totalFees: { increment: additionalCharge },
            grandTotal: nextGrandTotal,
            paymentStatus: this.calculatePaymentStatus(item.booking.totalPaid, nextGrandTotal) as PaymentStatus,
          },
        });
      }
      return { settlement, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!result.replayed) this.eventEmitter.emit('deposit.settled', result.settlement);
    return result.settlement;
  }

  // =========================================================================
  // BOOKING NUMBER LOOKUP (for SSLCommerz redirect)
  // =========================================================================

  /** Resolve a gateway callback only through its stored payment transaction. */
  async getBookingConfirmationForTransaction(transactionId: string) {
    return this.prisma.payment.findFirst({
      where: {
        transactionId,
        method: 'sslcommerz',
        status: { in: ['pending', 'verified'] },
      },
      select: {
        status: true,
        booking: { select: { bookingNumber: true, publicTrackingToken: true } },
      },
    });
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  /**
   * Calculates the booking payment status from totalPaid vs grandTotal.
   */
  private calculatePaymentStatus(totalPaid: number, grandTotal: number): string {
    if (totalPaid <= 0) return 'unpaid';
    if (totalPaid < grandTotal) return 'partial';
    return 'paid';
  }

  private async updateDepositProjection(
    tx: Prisma.TransactionClient,
    tenantId: string,
    bookingId: string,
    totalDeposit: number,
    verifiedDepositPaid: number,
  ) {
    if (totalDeposit <= 0) return;
    const depositStatus = verifiedDepositPaid <= 0
      ? 'pending'
      : verifiedDepositPaid < totalDeposit ? 'collected' : 'held';
    await tx.bookingItem.updateMany({
      where: {
        tenantId,
        bookingId,
        depositAmount: { gt: 0 },
        depositStatus: { in: ['pending', 'collected', 'held'] },
      },
      data: { depositStatus },
    });
  }

}
