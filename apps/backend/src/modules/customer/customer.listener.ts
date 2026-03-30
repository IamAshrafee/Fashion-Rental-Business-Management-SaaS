import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CustomerService } from './customer.service';

/**
 * Listens for booking and payment events to update customer denormalized stats.
 * Per ADR-05: cross-module effects via events, not direct service calls.
 */
@Injectable()
export class CustomerListener {
  private readonly logger = new Logger(CustomerListener.name);

  constructor(private readonly customerService: CustomerService) {}

  /**
   * When a booking is confirmed, increment the customer's totalBookings counter.
   */
  @OnEvent('booking.confirmed')
  async onBookingConfirmed(payload: { customerId: string; tenantId: string }) {
    try {
      await this.customerService.incrementBookingCount(payload.customerId, payload.tenantId);
      this.logger.debug(`Incremented booking count for customer ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to update customer stats on booking.confirmed: ${error}`);
    }
  }

  /**
   * When a payment is recorded, increment the customer's totalSpent counter.
   */
  @OnEvent('payment.recorded')
  async onPaymentRecorded(payload: { customerId: string; amount: number; tenantId: string }) {
    try {
      await this.customerService.incrementTotalSpent(payload.customerId, payload.amount, payload.tenantId);
      this.logger.debug(`Incremented total spent for customer ${payload.customerId} by ${payload.amount}`);
    } catch (error) {
      this.logger.error(`Failed to update customer stats on payment.recorded: ${error}`);
    }
  }
}
