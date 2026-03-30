import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogService } from './audit-log.service';
import type {
  BookingCreatedEvent,
  BookingStatusEvent,
  BookingCancelledEvent,
  PaymentReceivedEvent,
  DepositRefundedEvent,
  DepositForfeitedEvent,
} from '@closetrent/types';

/**
 * AuditLogListener — Records audit trail entries for significant actions.
 *
 * Listens to the same domain events as NotificationListener but persists
 * structured audit records instead of user-facing notifications. This keeps
 * audit logging decoupled from the core services (no direct injection needed).
 *
 * Note: Event-driven audit logs don't capture userId/IP from the request
 * context because events are emitted from the service layer. For actions
 * where the actor's identity matters (e.g., who cancelled a booking),
 * the event payload carries that information.
 */
@Injectable()
export class AuditLogListener {
  private readonly logger = new Logger(AuditLogListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  // --------------------------------------------------------------------------
  // BOOKING EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('booking.created')
  async onBookingCreated(event: BookingCreatedEvent) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system', // guest checkout — no authenticated user
        action: 'booking.created',
        entityType: 'booking',
        entityId: event.bookingId,
        newValues: {
          bookingNumber: event.bookingNumber,
          customerId: event.customerId,
          grandTotal: event.grandTotal,
        },
      });
    } catch (err) {
      this.logger.error(`Audit booking.created failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.confirmed')
  async onBookingConfirmed(event: BookingStatusEvent) {
    await this.recordStatusChange(event, 'booking.confirmed');
  }

  @OnEvent('booking.shipped')
  async onBookingShipped(event: BookingStatusEvent) {
    await this.recordStatusChange(event, 'booking.shipped', {
      trackingNumber: event.trackingNumber,
      courierProvider: event.courierProvider,
    });
  }

  @OnEvent('booking.delivered')
  async onBookingDelivered(event: BookingStatusEvent) {
    await this.recordStatusChange(event, 'booking.delivered');
  }

  @OnEvent('booking.returned')
  async onBookingReturned(event: BookingStatusEvent) {
    await this.recordStatusChange(event, 'booking.returned');
  }

  @OnEvent('booking.inspected')
  async onBookingInspected(event: BookingStatusEvent) {
    await this.recordStatusChange(event, 'booking.inspected');
  }

  @OnEvent('booking.completed')
  async onBookingCompleted(event: BookingStatusEvent) {
    await this.recordStatusChange(event, 'booking.completed');
  }

  @OnEvent('booking.cancelled')
  async onBookingCancelled(event: BookingCancelledEvent) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'booking.cancelled',
        entityType: 'booking',
        entityId: event.bookingId,
        newValues: {
          bookingNumber: event.bookingNumber,
          cancelledBy: event.cancelledBy,
          reason: event.reason,
        },
      });
    } catch (err) {
      this.logger.error(`Audit booking.cancelled failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.damage_reported')
  async onDamageReported(event: { tenantId: string; bookingId: string; itemId: string; damageLevel: string }) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'booking.damage_reported',
        entityType: 'booking_item',
        entityId: event.itemId,
        newValues: {
          bookingId: event.bookingId,
          damageLevel: event.damageLevel,
        },
      });
    } catch (err) {
      this.logger.error(`Audit damage_reported failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // PAYMENT EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('payment.received')
  async onPaymentReceived(event: PaymentReceivedEvent) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'payment.received',
        entityType: 'payment',
        entityId: event.paymentId,
        newValues: {
          bookingId: event.bookingId,
          bookingNumber: event.bookingNumber,
          amount: event.amount,
          method: event.method,
        },
      });
    } catch (err) {
      this.logger.error(`Audit payment.received failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('deposit.refunded')
  async onDepositRefunded(event: DepositRefundedEvent) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'deposit.refunded',
        entityType: 'booking_item',
        entityId: event.bookingItemId,
        newValues: {
          bookingId: event.bookingId,
          refundAmount: event.refundAmount,
          depositAmount: event.depositAmount,
          refundMethod: event.refundMethod,
        },
      });
    } catch (err) {
      this.logger.error(`Audit deposit.refunded failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('deposit.forfeited')
  async onDepositForfeited(event: DepositForfeitedEvent) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'deposit.forfeited',
        entityType: 'booking_item',
        entityId: event.bookingItemId,
        newValues: {
          bookingId: event.bookingId,
          depositAmount: event.depositAmount,
          reason: event.reason,
        },
      });
    } catch (err) {
      this.logger.error(`Audit deposit.forfeited failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // PRODUCT EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('product.created')
  async onProductCreated(event: { tenantId: string; productId: string }) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'product.published',
        entityType: 'product',
        entityId: event.productId,
      });
    } catch (err) {
      this.logger.error(`Audit product.created failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('product.updated')
  async onProductUpdated(event: { tenantId: string; productId: string }) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'product.updated',
        entityType: 'product',
        entityId: event.productId,
      });
    } catch (err) {
      this.logger.error(`Audit product.updated failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('product.deleted')
  async onProductDeleted(event: { tenantId: string; productId: string }) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'product.soft_deleted',
        entityType: 'product',
        entityId: event.productId,
      });
    } catch (err) {
      this.logger.error(`Audit product.deleted failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('product.restored')
  async onProductRestored(event: { tenantId: string; productId: string }) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action: 'product.restored',
        entityType: 'product',
        entityId: event.productId,
      });
    } catch (err) {
      this.logger.error(`Audit product.restored failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private async recordStatusChange(
    event: BookingStatusEvent,
    action: string,
    extra?: Record<string, unknown>,
  ) {
    try {
      await this.auditLogService.record({
        tenantId: event.tenantId,
        userId: 'system',
        action,
        entityType: 'booking',
        entityId: event.bookingId,
        newValues: {
          bookingNumber: event.bookingNumber,
          ...extra,
        },
      });
    } catch (err) {
      this.logger.error(`Audit ${action} failed: ${(err as Error).message}`);
    }
  }
}
