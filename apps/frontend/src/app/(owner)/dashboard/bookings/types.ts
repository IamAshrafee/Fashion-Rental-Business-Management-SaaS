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

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  totalOrders: number;
}

export interface DamageReport {
  id: string;
  bookingItemId: string;
  damageLevel: DamageLevel;
  description: string;
  estimatedRepairCost: number;
  deductionAmount: number;
  additionalCharge: number;
  photos: string[];
  reportedBy: string;
  createdAt: string;
}

export interface BookingItem {
  id: string;
  bookingId: string;
  productId: string;
  productName: string;
  variantName: string;
  sizeName: string;
  imageUrl?: string;
  
  startDate: string;
  endDate: string;
  days: number;
  
  rentalPrice: number;
  cleaningFee: number;
  backupSizeFee: number;
  depositAmount: number;
  lateFee: number;
  itemTotal: number;

  status: 'pending' | 'collected' | 'returned' | 'inspected';
  depositStatus: DepositStatus;
  
  damageReport?: DamageReport;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: 'COD' | 'bKash' | 'Nagad' | 'card' | 'bank_transfer' | 'cash';
  status: 'pending' | 'verified' | 'failed';
  transactionId?: string;
  recordedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface BookingTimelineEvent {
  id: string;
  status: BookingStatus;
  timestamp: string;
  user?: string;
  note?: string;
}

export interface Booking {
  id: string;
  orderNumber: string;
  createdAt: string;
  
  customer: Customer;
  items: BookingItem[];
  payments: Payment[];
  timeline: BookingTimelineEvent[];

  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  
  // Pricing Totals
  subtotal: number;
  cleaningFeeTotal: number;
  backupSizeFeeTotal: number;
  shippingFee: number;
  depositTotal: number;
  lateFeeTotal: number;
  discount: number;
  grandTotal: number;
  
  amountPaid: number;
  balance: number;

  notes?: string;
  courierName?: string;
  trackingNumber?: string;
}
