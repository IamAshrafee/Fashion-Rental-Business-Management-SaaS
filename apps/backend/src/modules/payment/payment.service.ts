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
  DepositStatus,
  Prisma,
} from '@prisma/client';
import {
  RecordPaymentDto,
  RefundDepositDto,
  ForfeitDepositDto,
} from './dto/payment.dto';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PaymentSummary {
  totalDue: number;
  totalPaid: number;
  balance: number;
  paymentStatus: string;
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
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Prevent duplicate transaction IDs
    if (dto.transactionId) {
      const existing = await this.prisma.payment.findFirst({
        where: { tenantId, transactionId: dto.transactionId },
      });
      if (existing) {
        throw new ConflictException(
          `Payment with transaction ID "${dto.transactionId}" already exists`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create payment record (manual payments are immediately verified)
      const payment = await tx.payment.create({
        data: {
          tenantId,
          bookingId,
          amount: dto.amount,
          method: dto.method as PaymentMethod,
          status: 'verified' as TransactionStatus,
          transactionId: dto.transactionId ?? null,
          notes: dto.notes ?? null,
          recordedBy,
          verifiedAt: new Date(),
        },
      });

      // Update booking totalPaid
      const newTotalPaid = booking.totalPaid + dto.amount;

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

      return payment;
    });

    // Emit event (ADR-05)
    this.eventEmitter.emit('payment.received', {
      tenantId,
      bookingId,
      paymentId: result.id,
      amount: result.amount,
      method: result.method,
      bookingNumber: booking.bookingNumber,
    });

    this.logger.log(
      `Payment recorded: ${dto.amount} via ${dto.method} for booking ${booking.bookingNumber}`,
    );

    return result;
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
        totalPaid: true,
        paymentStatus: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payments = await this.prisma.payment.findMany({
      where: { bookingId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
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

    const summary: PaymentSummary = {
      totalDue: booking.grandTotal,
      totalPaid: booking.totalPaid,
      balance: booking.grandTotal - booking.totalPaid,
      paymentStatus: booking.paymentStatus,
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
  ): Promise<SslcommerzInitResult> {
    // Load booking + tenant's store settings
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      select: {
        id: true,
        bookingNumber: true,
        grandTotal: true,
        totalPaid: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddressLine1: true,
        deliveryCity: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const remainingAmount = booking.grandTotal - booking.totalPaid;
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

    // Build SSLCommerz init payload
    const baseUrl = this.configService.get<string>('app.backendUrl', 'http://localhost:4000');


    const payload = new URLSearchParams({
      store_id: storeSettings.sslcommerzStoreId,
      store_passwd: storeSettings.sslcommerzStorePass,
      total_amount: String(remainingAmount),
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
        amount: remainingAmount,
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
      val_id: _validationId,
      verify_sign: _verifySign,
    } = ipnPayload;

    if (!transactionId || !status) {
      this.logger.warn('Invalid IPN payload — missing tran_id or status');
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

    if (storeSettings?.sslcommerzStoreId !== storeId) {
      this.logger.warn(
        `IPN store_id mismatch for ${transactionId}: expected ${storeSettings?.sslcommerzStoreId}, got ${storeId}`,
      );
      return;
    }

    if (status === 'VALID' || status === 'VALIDATED') {
      // Verify amount matches
      const ipnAmount = parseInt(String(amount), 10);
      if (ipnAmount !== payment.amount) {
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
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'verified' as TransactionStatus,
            verifiedAt: new Date(),
            providerResponse: ipnPayload as unknown as Prisma.InputJsonValue,
          },
        });

        const newTotalPaid = booking.totalPaid + payment.amount;
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
      });

      this.eventEmitter.emit('payment.received', {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        paymentId: payment.id,
        amount: payment.amount,
        method: 'sslcommerz',
        bookingNumber: booking.bookingNumber,
      });

      this.logger.log(
        `SSLCommerz payment verified for booking ${booking.bookingNumber}: ${payment.amount}`,
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

  // =========================================================================
  // DEPOSIT MANAGEMENT
  // =========================================================================

  /**
   * Marks a booking item's deposit as collected.
   * Used when owner confirms deposit has been received (COD on delivery, or digital verification).
   */
  async collectDeposit(tenantId: string, bookingItemId: string) {
    const item = await this.findBookingItemOrFail(tenantId, bookingItemId);

    if (item.depositAmount <= 0) {
      throw new UnprocessableEntityException('This item has no deposit configured');
    }

    if (item.depositStatus !== 'pending') {
      throw new UnprocessableEntityException(
        `Deposit is already "${item.depositStatus}". Can only collect from "pending" status.`,
      );
    }

    const updated = await this.prisma.bookingItem.update({
      where: { id: bookingItemId },
      data: { depositStatus: 'collected' as DepositStatus },
    });

    this.logger.log(`Deposit collected for booking item ${bookingItemId}`);
    return updated;
  }

  /**
   * Processes a deposit refund (full or partial).
   * Records refund amount, method, and date on the booking item.
   */
  async refundDeposit(
    tenantId: string,
    bookingItemId: string,
    dto: RefundDepositDto,
  ) {
    const item = await this.findBookingItemOrFail(tenantId, bookingItemId);

    // Deposit must be collected before it can be refunded
    if (!['collected', 'held'].includes(item.depositStatus)) {
      throw new UnprocessableEntityException(
        `Deposit must be "collected" or "held" to process a refund. Current status: "${item.depositStatus}".`,
      );
    }

    if (dto.refundAmount > item.depositAmount) {
      throw new BadRequestException(
        `Refund amount (${dto.refundAmount}) cannot exceed deposit amount (${item.depositAmount})`,
      );
    }

    // Determine new status
    const newStatus: DepositStatus =
      dto.refundAmount === item.depositAmount
        ? 'refunded'
        : dto.refundAmount === 0
          ? 'forfeited'
          : 'partially_refunded';

    const updated = await this.prisma.bookingItem.update({
      where: { id: bookingItemId },
      data: {
        depositStatus: newStatus,
        depositRefundAmount: dto.refundAmount,
        depositRefundMethod: dto.refundMethod,
        depositRefundDate: new Date(),
      },
    });

    this.eventEmitter.emit('deposit.refunded', {
      tenantId,
      bookingItemId,
      bookingId: item.bookingId,
      refundAmount: dto.refundAmount,
      depositAmount: item.depositAmount,
      refundMethod: dto.refundMethod,
    });

    this.logger.log(
      `Deposit ${newStatus}: ${dto.refundAmount}/${item.depositAmount} for item ${bookingItemId}`,
    );

    return updated;
  }

  /**
   * Forfeits a deposit entirely (e.g., severe damage or loss).
   */
  async forfeitDeposit(
    tenantId: string,
    bookingItemId: string,
    dto: ForfeitDepositDto,
  ) {
    const item = await this.findBookingItemOrFail(tenantId, bookingItemId);

    if (!['collected', 'held'].includes(item.depositStatus)) {
      throw new UnprocessableEntityException(
        `Deposit must be "collected" or "held" to forfeit. Current status: "${item.depositStatus}".`,
      );
    }

    const updated = await this.prisma.bookingItem.update({
      where: { id: bookingItemId },
      data: {
        depositStatus: 'forfeited' as DepositStatus,
        depositRefundAmount: 0,
        depositRefundDate: new Date(),
      },
    });

    this.eventEmitter.emit('deposit.forfeited', {
      tenantId,
      bookingItemId,
      bookingId: item.bookingId,
      depositAmount: item.depositAmount,
      reason: dto.reason,
    });

    this.logger.log(`Deposit forfeited for item ${bookingItemId}: ${dto.reason}`);

    return updated;
  }

  // =========================================================================
  // BOOKING NUMBER LOOKUP (for SSLCommerz redirect)
  // =========================================================================

  /**
   * Simple helper to get booking number by ID.
   * Used by payment controller to redirect to confirmation page.
   */
  async getBookingNumber(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { bookingNumber: true },
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

  /**
   * Finds a booking item or throws NotFoundException.
   * Validates it belongs to the given tenant.
   */
  private async findBookingItemOrFail(tenantId: string, bookingItemId: string) {
    const item = await this.prisma.bookingItem.findFirst({
      where: { id: bookingItemId, tenantId },
      select: {
        id: true,
        bookingId: true,
        tenantId: true,
        productName: true,
        depositAmount: true,
        depositStatus: true,
        depositRefundAmount: true,
      },
    });
    if (!item) throw new NotFoundException('Booking item not found');
    return item;
  }
}
