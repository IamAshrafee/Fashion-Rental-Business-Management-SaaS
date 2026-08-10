/**
 * Bookings Module — Shared Types
 *
 * These types are aligned with the backend Prisma schema and API response shapes.
 * BookingDetailResponse from '@/lib/api/bookings' is the canonical source for the
 * detail page. These local types serve the components that need a narrower interface.
 */

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'delivered'
  | 'returned'
  | 'inspected'
  | 'overdue'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 
  | 'unpaid'
  | 'partial'
  | 'paid';

export type DepositStatus = 
  | 'pending'
  | 'collected'
  | 'held'
  | 'refunded'
  | 'partially_refunded'
  | 'forfeited';

export type DamageLevel = 
  | 'none'
  | 'minor'
  | 'moderate'
  | 'severe'
  | 'destroyed'
  | 'lost';

export interface DamageReport {
  id: string;
  bookingItemId: string;
  damageLevel: DamageLevel;
  description: string;
  estimatedRepairCost: number | null;
  deductionAmount: number;
  additionalCharge: number;
  photos: string[];
  reportedBy: string;
  createdAt: string;
}

/**
 * BookingItem — aligned with BookingDetailItem from the API response.
 * Field names now match the backend (rentalDays, sizeInfo, featuredImageUrl, etc.).
 */
export interface BookingItem {
  id: string;
  bookingId: string;
  productId: string;
  productName: string;
  variantName: string;
  sizeInfo: string | null;
  featuredImageUrl: string;
  
  startDate: string;
  endDate: string;
  rentalDays: number;

  baseRental: number;
  extendedCost: number;
  cleaningFee: number;
  backupSizeFee: number;
  depositAmount: number;
  lateFee: number;
  itemTotal: number;
  fulfillmentAdjustment: number;
  requiresExactDamageIssue: boolean;
  stockUnitIssues: Array<{
    id: string;
    issueType: string;
    severity: string;
    status: string;
    responsibility: string;
    description: string;
    stockUnit: { id: string; assetCode: string };
  }>;

  depositStatus: DepositStatus;
  
  damageReport?: DamageReport;
  depositSettlement?: {
    id: string;
    refundAmount: number;
    deductionAmount: number;
    forfeitedAmount: number;
    additionalCharge: number;
    refundMethod: string | null;
    reason: string;
    actorUserId: string;
    createdAt: string;
  };
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  rentalAmount: number;
  depositAmount: number;
  method: string;
  status: string;
  transactionId?: string | null;
  recordedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface BookingTimelineEvent {
  id: string;
  status: string | BookingStatus;
  timestamp: string;
  user?: string;
  note?: string;
  label?: string;
  type?: 'business' | 'courier' | 'operation' | 'payment' | 'return';
}

/**
 * Booking — used by PriceBreakdown and other composite views.
 * Fields are aligned with BookingDetailResponse from the API.
 */
export interface Booking {
  id: string;
  bookingNumber: string;
  createdAt: string;
  
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
    totalBookings: number;
  };

  items: BookingItem[];
  payments: Payment[];
  timeline: BookingTimelineEvent[];

  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  
  // Pricing Totals
  subtotal: number;
  totalFees: number;
  shippingFee: number;
  totalDeposit: number;
  grandTotal: number;
  totalPaid: number;
  balance: number;

  notes?: string;
  courierProvider?: string;
  trackingNumber?: string;
}
