export type CustomerStatus = 'active' | 'blocked' | 'merged' | 'anonymized' | 'archived';
export type CustomerIdentityKind = 'phone' | 'email';
export type CustomerAddressKind = 'delivery' | 'billing' | 'other';
export type CustomerContactChannel = 'phone' | 'sms' | 'whatsapp' | 'email';

export interface CustomerIdentity {
  id: string;
  kind: CustomerIdentityKind;
  value: string;
  normalizedValue: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export interface CustomerAddress {
  id: string;
  kind: CustomerAddressKind;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  instructions: string | null;
  isDefault: boolean;
  lastUsedAt: string | null;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string | null;
  _count?: { assignments: number };
}

export interface Customer {
  id: string;
  fullName: string;
  status: CustomerStatus;
  preferredContactChannel: CustomerContactChannel;
  preferredLocale: string;
  source: string | null;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  primaryEmail: string | null;
  defaultAddress: CustomerAddress | null;
  identities: CustomerIdentity[];
  addresses: CustomerAddress[];
  totalBookings: number;
  totalSpent: number;
  lastBookingAt: string | null;
  tags: CustomerTag[];
  account: { id: string; status: string; activatedAt: string | null; lastLoginAt: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerBooking {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  createdAt: string;
  items: Array<{ productName: string; colorName?: string | null }>;
}

export interface CustomerNote {
  id: string;
  body: string;
  isPinned: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface CustomerConsent {
  id: string;
  purpose: string;
  channel: CustomerContactChannel | null;
  granted: boolean;
  source: string;
  recordedAt: string;
}

export interface CustomerEvent {
  id: string;
  type: string;
  summary: string;
  data: Record<string, unknown> | null;
  occurredAt: string;
}

export interface CustomerDetail extends Customer {
  notes: CustomerNote[];
  consents: CustomerConsent[];
  events: CustomerEvent[];
  bookings: CustomerBooking[];
  totalBookingCount: number;
}

export interface CustomerIdentityInput {
  kind: CustomerIdentityKind;
  value: string;
  isPrimary?: boolean;
}

export interface CustomerAddressInput {
  kind?: CustomerAddressKind;
  label?: string;
  recipientName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  instructions?: string;
  isDefault?: boolean;
}

export interface CreateCustomerDto {
  fullName: string;
  identities: CustomerIdentityInput[];
  address?: CustomerAddressInput;
  preferredContactChannel?: CustomerContactChannel;
  preferredLocale?: string;
  source?: string;
  note?: string;
}

export interface UpdateCustomerDto {
  fullName?: string;
  status?: CustomerStatus;
  preferredContactChannel?: CustomerContactChannel;
  preferredLocale?: string;
  source?: string;
}

export interface AddCustomerTagDto {
  tagId: string;
}
