# Event System

## Overview

NestJS EventEmitter2 for decoupled side-effects. When a business action occurs, an event is emitted. Separate listeners handle SMS, notifications, audit logs, and other side-effects independently.

---

## Architecture

```
BookingService.confirm()
       │
       ├── Update booking status in DB
       ├── Update date blocks
       │
       ▼
eventEmitter.emit('booking.confirmed', { booking, tenant })
       │
       ├──→ SMSListener: send confirmation SMS to customer
       ├──→ NotificationListener: create in-app notification for owner
       ├──→ AuditListener: log status change
       └──→ AnalyticsListener: increment booking count
```

---

## Event Registry

### Booking Events

| Event | Payload | Listeners |
|---|---|---|
| `booking.created` | booking, tenant, customer | SMS (owner), Notification (owner), Audit |
| `booking.confirmed` | booking, tenant | SMS (customer), Notification, Audit, DateBlock (upgrade to 'booking') |
| `booking.cancelled` | booking, tenant, reason | SMS (customer), Notification, Audit, DateBlock (release) |
| `booking.shipped` | booking, tenant, tracking | SMS (customer), Notification, Audit |
| `booking.delivered` | booking, tenant | Audit, Schedule (start return countdown) |
| `booking.overdue` | booking, tenant, lateDays | SMS (customer, day 1 only), Notification (owner), Audit |
| `booking.returned` | booking, tenant | Notification (owner), Audit |
| `booking.inspected` | booking, tenant, damageReport | Audit |
| `booking.completed` | booking, tenant | SMS (customer), Notification, Audit, Analytics (update stats) |
| `booking.returnReminder` | booking, tenant | SMS (customer) |

### Payment Events

| Event | Payload | Listeners |
|---|---|---|
| `payment.recorded` | payment, booking, tenant | Notification (owner), Audit, Booking (update paymentStatus) |
| `payment.sslcommerzVerified` | payment, booking, tenant | SMS (customer), Notification, Audit |

### Product Events

| Event | Payload | Listeners |
|---|---|---|
| `product.published` | product, tenant | Search (index), Audit |
| `product.unpublished` | product, tenant | Search (remove from index), Audit |
| `product.deleted` | product, tenant | Search (remove), Audit |

### Deposit Events

| Event | Payload | Listeners |
|---|---|---|
| `deposit.collected` | bookingItem, tenant | Audit |
| `deposit.refunded` | bookingItem, tenant, amount, method | SMS (customer), Audit |
| `deposit.forfeited` | bookingItem, tenant, reason | Audit |

### Tenant Events

| Event | Payload | Listeners |
|---|---|---|
| `tenant.created` | tenant, owner | Seed (default data), Audit |
| `tenant.suspended` | tenant, reason | Notification (owner), Audit |
| `tenant.subscriptionExpiring` | tenant, daysLeft | Notification (owner), SMS (owner) |

### Auth Events

| Event | Payload | Listeners |
|---|---|---|
| `auth.login` | user, tenant, ip | Audit |
| `auth.loginFailed` | phone, ip, attempts | Audit, Security (lockout check) |
| `auth.passwordChanged` | user | SMS (user), Audit |

---

## Implementation

### Event Emitting

```typescript
@Injectable()
export class BookingService {
  constructor(private eventEmitter: EventEmitter2) {}

  async confirm(bookingId: string, tenantId: string): Promise<Booking> {
    const booking = await this.prisma.booking.update({
      where: { id: bookingId, tenantId },
      data: { status: 'confirmed' },
      include: { tenant: true, customer: true },
    });

    // Upgrade date blocks
    await this.dateBlockService.confirmBlocks(bookingId);

    // Emit event — all side-effects handled by listeners
    this.eventEmitter.emit('booking.confirmed', {
      booking,
      tenant: booking.tenant,
    });

    return booking;
  }
}
```

### Event Listeners

```typescript
@Injectable()
export class BookingSMSListener {
  @OnEvent('booking.confirmed')
  async handleConfirmed({ booking, tenant }) {
    if (!tenant.settings.smsEnabled) return;

    await this.smsQueue.add('sms.send', {
      to: booking.customer.phone,
      template: 'booking_confirmed',
      data: { bookingNumber: booking.number, storeName: tenant.name },
    });
  }

  @OnEvent('booking.overdue')
  async handleOverdue({ booking, tenant, lateDays }) {
    // Only SMS on day 1 of overdue
    if (lateDays > 1) return;

    await this.smsQueue.add('sms.send', {
      to: booking.customer.phone,
      template: 'booking_overdue',
      data: { bookingNumber: booking.number },
    });
  }
}

@Injectable()
export class AuditListener {
  @OnEvent('booking.**')
  async handleBookingEvent(event: string, data: any) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: data.tenant.id,
        entityType: 'booking',
        entityId: data.booking.id,
        action: event,
        performedBy: data.performedBy || 'system',
        timestamp: new Date(),
      },
    });
  }
}
```

---

## Key Rule

**Services NEVER directly call SMS, notification, or audit services.** They only emit events. This ensures:
- Adding new side-effects = adding a listener (no existing code changes)
- Side-effects failing doesn't break the main action
- Easy to test services in isolation
