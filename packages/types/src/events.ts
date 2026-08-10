// ============================================
// ClosetRent — Typed Event Payloads (ADR-05)
// Used by EventEmitter2 event listeners
// ============================================

// --- Booking Events ---

export interface BookingCreatedEvent {
  tenantId: string;
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  grandTotal: number;
}

export interface BookingStatusEvent {
  tenantId: string;
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  trackingNumber?: string;
  courierProvider?: string;
}

export interface BookingCancelledEvent {
  tenantId: string;
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  reason: string;
  cancelledBy: 'customer' | 'owner' | 'system';
}

export interface BookingOverdueEvent {
  tenantId: string;
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  lateDays: number;
}

export interface BookingReturnReminderEvent {
  tenantId: string;
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  returnDate: string;
}

// --- Payment Events ---

export interface PaymentReceivedEvent {
  tenantId: string;
  bookingId: string;
  paymentId: string;
  bookingNumber: string;
  amount: number;
  method: string;
}

export interface DepositSettledEvent {
  id: string;
  tenantId: string;
  bookingId: string;
  bookingItemId: string;
  damageReportId: string | null;
  refundAmount: number;
  deductionAmount: number;
  forfeitedAmount: number;
  additionalCharge: number;
  refundMethod: string | null;
  reason: string;
  actorUserId: string;
  createdAt: Date;
}

// --- Tenant Events ---

export interface TenantCreatedEvent {
  tenantId: string;
  ownerId: string;
}

export interface TenantSuspendedEvent {
  tenantId: string;
  reason: string;
}

export interface TenantSubscriptionExpiringEvent {
  tenantId: string;
  daysLeft: number;
}

// --- Auth Events ---

export interface AuthLoginEvent {
  userId: string;
  tenantId: string | null;
  ipAddress: string;
}

export interface AuthLoginFailedEvent {
  phone: string;
  ipAddress: string;
  attempts: number;
}

// --- Admin Events ---

export interface AdminTenantImpersonatedEvent {
  adminUserId: string;
  tenantId: string;
  ownerUserId: string;
  businessName: string;
  timestamp: string;
}

export interface AdminTenantStatusChangedEvent {
  adminUserId: string;
  tenantId: string;
  businessName: string;
  oldStatus: string;
  newStatus: string;
  reason?: string;
  timestamp: string;
}

export interface AdminTenantPlanChangedEvent {
  adminUserId: string;
  tenantId: string;
  oldPlanId: string | null;
  newPlanId: string;
  billingCycle: string;
  timestamp: string;
}
