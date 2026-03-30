import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { SmsService } from './sms/sms.service';
import type {
  BookingCreatedEvent,
  BookingStatusEvent,
  BookingCancelledEvent,
  BookingOverdueEvent,
  PaymentReceivedEvent,
  DepositRefundedEvent,
  DepositForfeitedEvent,
  TenantSuspendedEvent,
  TenantSubscriptionExpiringEvent,
} from '@closetrent/types';

interface StoreInfo {
  storeName: string;
  smsEnabled: boolean;
  phone: string | null;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly smsService: SmsService,
  ) {}

  // --------------------------------------------------------------------------
  // BOOKING EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('booking.created')
  async handleBookingCreated(event: BookingCreatedEvent) {
    try {
      const [booking, store] = await Promise.all([
        this.prisma.booking.findUnique({
          where: { id: event.bookingId },
          include: { customer: { select: { fullName: true, phone: true } } },
        }),
        this.getStoreInfo(event.tenantId),
      ]);

      if (!booking || !store) return;

      // In-app notification for owner
      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'new_booking',
        title: `New booking from ${booking.customer.fullName}`,
        message: `Booking ${event.bookingNumber} · ৳${event.grandTotal}`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });

      // SMS to owner (if enabled and phone is configured)
      if (store.smsEnabled && store.phone) {
        await this.smsService.send(store.phone, 'new_booking_owner', {
          bookingNumber: event.bookingNumber,
          customerName: booking.customer.fullName,
          totalAmount: event.grandTotal,
        });
      }

      // SMS to customer — booking placement confirmation (#9)
      if (store.smsEnabled && booking.customer.phone) {
        await this.smsService.send(booking.customer.phone, 'booking_placed', {
          bookingNumber: event.bookingNumber,
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleBookingCreated failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.confirmed')
  async handleBookingConfirmed(event: BookingStatusEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_confirmed',
        title: `Booking ${event.bookingNumber} confirmed`,
        message: `Order has been confirmed for ${booking.customer.fullName}`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });

      if (store.smsEnabled && booking.customer.phone) {
        const deliveryDate = booking.items[0]?.startDate?.toLocaleDateString('en-BD') ?? 'soon';
        await this.smsService.send(booking.customer.phone, 'booking_confirmed', {
          bookingNumber: event.bookingNumber,
          deliveryDate,
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleBookingConfirmed failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.cancelled')
  async handleBookingCancelled(event: BookingCancelledEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_cancelled',
        title: `Booking ${event.bookingNumber} cancelled`,
        message: `Cancelled by ${event.cancelledBy}. Reason: ${event.reason || 'Not specified'}`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });

      if (store.smsEnabled && booking.customer.phone) {
        await this.smsService.send(booking.customer.phone, 'booking_cancelled', {
          bookingNumber: event.bookingNumber,
          phone: store.phone ?? '',
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleBookingCancelled failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.shipped')
  async handleBookingShipped(event: BookingStatusEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_shipped',
        title: `Order ${event.bookingNumber} shipped`,
        message: `Tracking: ${event.trackingNumber ?? 'N/A'} via ${event.courierProvider ?? 'courier'}`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });

      if (store.smsEnabled && booking.customer.phone) {
        await this.smsService.send(booking.customer.phone, 'booking_shipped', {
          bookingNumber: event.bookingNumber,
          trackingLink: event.trackingNumber ?? 'N/A',
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleBookingShipped failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.overdue')
  async handleBookingOverdue(event: BookingOverdueEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_overdue',
        title: `OVERDUE: ${event.bookingNumber} not returned`,
        message: `${booking.customer.fullName} — ${event.lateDays} day(s) late`,
        data: {
          bookingId: event.bookingId,
          bookingNumber: event.bookingNumber,
          lateDays: event.lateDays,
        },
      });

      // SMS to customer only on day 1
      if (event.lateDays <= 1 && store.smsEnabled && booking.customer.phone) {
        await this.smsService.send(booking.customer.phone, 'booking_overdue', {
          bookingNumber: event.bookingNumber,
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleBookingOverdue failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.completed')
  async handleBookingCompleted(event: BookingStatusEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_completed',
        title: `Booking ${event.bookingNumber} completed`,
        message: `Order for ${booking.customer.fullName} has been completed`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });

      if (store.smsEnabled && booking.customer.phone) {
        const depositTotal = booking.items.reduce(
          (sum, item) => sum + (item.depositAmount ?? 0),
          0,
        );
        await this.smsService.send(booking.customer.phone, 'booking_completed', {
          depositAmount: depositTotal,
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleBookingCompleted failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // BOOKING LIFECYCLE — DELIVERED / RETURNED / INSPECTED
  // --------------------------------------------------------------------------

  @OnEvent('booking.delivered')
  async handleBookingDelivered(event: BookingStatusEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_delivered',
        title: `Order ${event.bookingNumber} delivered`,
        message: `Delivered to ${booking.customer.fullName}`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });
    } catch (err) {
      this.logger.error(`handleBookingDelivered failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.returned')
  async handleBookingReturned(event: BookingStatusEvent) {
    try {
      const [booking, store] = await this.getBookingAndStore(event);
      if (!booking || !store) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_returned',
        title: `Booking ${event.bookingNumber} returned`,
        message: `${booking.customer.fullName} returned the rental items`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });
    } catch (err) {
      this.logger.error(`handleBookingReturned failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.inspected')
  async handleBookingInspected(event: BookingStatusEvent) {
    try {
      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'booking_inspected',
        title: `Inspection completed for ${event.bookingNumber}`,
        message: 'Items inspected. You can now complete the order.',
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber },
      });
    } catch (err) {
      this.logger.error(`handleBookingInspected failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('booking.damage_reported')
  async handleDamageReported(event: { tenantId: string; bookingId: string; itemId: string; damageLevel: string }) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: event.bookingId },
        select: { bookingNumber: true },
      });
      if (!booking) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'damage_reported',
        title: `Damage reported on ${booking.bookingNumber}`,
        message: `Damage level: ${event.damageLevel}`,
        data: { bookingId: event.bookingId, itemId: event.itemId, damageLevel: event.damageLevel },
      });
    } catch (err) {
      this.logger.error(`handleDamageReported failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // PAYMENT EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('payment.received')
  async handlePaymentReceived(event: PaymentReceivedEvent) {
    try {
      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'payment_received',
        title: `Payment of ৳${event.amount} received`,
        message: `For booking ${event.bookingNumber} via ${event.method}`,
        data: { bookingId: event.bookingId, bookingNumber: event.bookingNumber, amount: event.amount },
      });
    } catch (err) {
      this.logger.error(`handlePaymentReceived failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // DEPOSIT EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('deposit.refunded')
  async handleDepositRefunded(event: DepositRefundedEvent) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: event.bookingId },
        select: { bookingNumber: true, tenantId: true },
      });
      if (!booking) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'deposit_refunded',
        title: `Deposit of ৳${event.refundAmount} refunded`,
        message: `For booking ${booking.bookingNumber} via ${event.refundMethod}`,
        data: { bookingId: event.bookingId, amount: event.refundAmount },
      });
    } catch (err) {
      this.logger.error(`handleDepositRefunded failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('deposit.forfeited')
  async handleDepositForfeited(event: DepositForfeitedEvent) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: event.bookingId },
        select: { bookingNumber: true },
      });
      if (!booking) return;

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'deposit_forfeited',
        title: `Deposit forfeited on ${booking.bookingNumber}`,
        message: `Reason: ${event.reason}`,
        data: { bookingId: event.bookingId, reason: event.reason },
      });
    } catch (err) {
      this.logger.error(`handleDepositForfeited failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // TENANT EVENTS
  // --------------------------------------------------------------------------

  @OnEvent('tenant.suspended')
  async handleTenantSuspended(event: TenantSuspendedEvent) {
    try {
      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'tenant_suspended',
        title: 'Your store has been suspended',
        message: `Reason: ${event.reason}. Please contact support.`,
        data: { reason: event.reason },
      });
    } catch (err) {
      this.logger.error(`handleTenantSuspended failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('tenant.subscriptionExpiring')
  async handleSubscriptionExpiring(event: TenantSubscriptionExpiringEvent) {
    try {
      const store = await this.getStoreInfo(event.tenantId);

      await this.notificationService.create({
        tenantId: event.tenantId,
        type: 'subscription_expiring',
        title: `Subscription expiring in ${event.daysLeft} day(s)`,
        message: 'Please renew your subscription to avoid service interruption.',
        data: { daysLeft: event.daysLeft },
      });

      if (store?.smsEnabled && store.phone) {
        await this.smsService.send(store.phone, 'subscription_expiring', {
          daysLeft: event.daysLeft,
          storeName: store.storeName,
        });
      }
    } catch (err) {
      this.logger.error(`handleSubscriptionExpiring failed: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async getStoreInfo(tenantId: string): Promise<StoreInfo | null> {
    const [settings, tenant] = await Promise.all([
      this.prisma.storeSettings.findUnique({
        where: { tenantId },
        select: { smsEnabled: true, phone: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessName: true },
      }),
    ]);

    if (!settings || !tenant) return null;

    return {
      storeName: tenant.businessName,
      smsEnabled: settings.smsEnabled,
      phone: settings.phone,
    };
  }

  private async getBookingAndStore(event: {
    tenantId: string;
    bookingId: string;
    trackingNumber?: string;
    courierProvider?: string;
  }) {
    const [booking, store] = await Promise.all([
      this.prisma.booking.findUnique({
        where: { id: event.bookingId },
        include: {
          customer: { select: { fullName: true, phone: true } },
          items: { select: { depositAmount: true, startDate: true } },
        },
      }),
      this.getStoreInfo(event.tenantId),
    ]);

    return [booking, store] as const;
  }
}
