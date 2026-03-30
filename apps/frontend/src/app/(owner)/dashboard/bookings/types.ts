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
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'inspected'
  | 'overdue'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'refunded';

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

  depositStatus: DepositStatus;
  
  damageReport?: DamageReport;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: string;
  status: string;
  transactionId?: string | null;
  recordedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface BookingTimelineEvent {
  id: string;
  status: BookingStatus;
  timestamp: string;
  user?: string;
  note?: string;
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
