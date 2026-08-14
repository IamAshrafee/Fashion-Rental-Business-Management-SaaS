import apiClient from '@/lib/api-client';
import { ApiResponse } from '@closetrent/types';

export type StorefrontCartItem = CartValidationRequest['items'][number] & {
  lineKey: string;
  displaySnapshot?: Record<string, unknown>;
};

export interface StorefrontCartResponse {
  id: string | null;
  items: StorefrontCartItem[];
  expiresAt: string | null;
}

export async function getStorefrontCart(): Promise<StorefrontCartResponse> {
  const response = await apiClient.get<ApiResponse<StorefrontCartResponse>>('/storefront/cart');
  if (!response.data.success) throw new Error(response.data.message || 'Failed to load cart');
  return response.data.data;
}

export async function replaceStorefrontCart(items: StorefrontCartItem[]): Promise<StorefrontCartResponse> {
  const response = await apiClient.put<ApiResponse<StorefrontCartResponse>>('/storefront/cart', { items });
  if (!response.data.success) throw new Error(response.data.message || 'Failed to save cart');
  return response.data.data;
}

// ─── Cart Validation ─────────────────────────────────────────────────────────

export interface CartValidationRequest {
  items: Array<{
    productId: string;
    variantId: string;
    variantSizeId: string;
    quantity: number;
    startDate: string;
    endDate: string;
    selectedSize?: string;
    backupSize?: string;
    tryOn?: boolean;
    compositionSelections?: Array<{
      compositionRuleId: string;
      productId?: string;
      variantSizeId?: string;
      quantity?: number;
    }>;
  }>;
  issueCheckoutQuote?: boolean;
}

export interface CartValidationResponse {
  valid: boolean;
  items: Array<{
    productId: string;
    available: boolean;
    rentalDays: number;
    rentalPrice: number;
    deposit: number;
    cleaningFee: number;
    extendedDays: number;
    extendedCost: number;
    backupSizeFee: number;
    tryOnFee: number;
    itemTotal: number;
    shippingFee: number;
    errors?: string[];
    fulfillmentRequirements?: Array<{
      requirementKey: string;
      role: string;
      productId: string;
      variantSizeId: string;
      quantity: number;
      productName: string;
      variantName: string | null;
      sizeLabel: string;
      priceAdjustment: number;
    }>;
  }>;
  summary: {
    subtotal: number;
    totalFees: number;
    totalDeposit: number;
    shippingFee: number;
    grandTotal: number;
  };
  checkoutQuote?: {
    id: string;
    quoteHash: string;
    expiresAt: string;
  };
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutCustomerPayload {
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
}

export interface CheckoutDeliveryPayload {
  address: string;
  area?: string;
  thana?: string;
  district?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CheckoutPayload {
  customer: CheckoutCustomerPayload;
  delivery: CheckoutDeliveryPayload;
  items: Array<{
    productId: string;
    variantId: string;
    variantSizeId: string;
    quantity: number;
    startDate: string;
    endDate: string;
    selectedSize?: string;
    backupSize?: string;
    tryOn?: boolean;
    compositionSelections?: Array<{
      compositionRuleId: string;
      productId?: string;
      variantSizeId?: string;
      quantity?: number;
    }>;
  }>;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'sslcommerz';
  checkoutQuoteId: string;
  checkoutQuoteHash: string;
  bkashTransactionId?: string;
  nagadTransactionId?: string;
  customerNotes?: string;
}

export interface BookingResponse {
  bookingId: string;
  bookingNumber: string;
  trackingToken: string;
  status: string;
  paymentMethod: CheckoutPayload['paymentMethod'];
  grandTotal: number;
  breakdown: CartValidationResponse['summary'] & { discountAmount: number };
}

/**
 * Validates the full cart at checkout time.
 * Verifies availability and recalculates prices centrally to prevent tampering.
 *
 * POST /api/v1/bookings/validate
 */
export async function validateCart(payload: CartValidationRequest): Promise<CartValidationResponse> {
  const response = await apiClient.post<ApiResponse<CartValidationResponse>>('/bookings/validate', payload);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Validation failed');
  }
  return response.data.data;
}

/**
 * Finalizes the order submission to the server.
 * The payload shape matches the backend's CreateBookingDto exactly:
 * - customer: { fullName, phone, altPhone?, email? }
 * - delivery: { address, area?, thana?, district?, city?, ... }
 * - items: [{ productId, variantId, startDate, endDate, tryOn?, backupSize? }]
 * - paymentMethod: 'cod' | 'bkash' | 'nagad' | 'sslcommerz'
 *
 * POST /api/v1/bookings
 */
export async function createBooking(payload: CheckoutPayload, idempotencyKey: string): Promise<BookingResponse> {
  const response = await apiClient.post<ApiResponse<BookingResponse>>('/bookings', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to submit booking');
  }
  return response.data.data;
}

export async function initiateSslcommerz(bookingId: string, trackingToken: string): Promise<string> {
  const response = await apiClient.post<ApiResponse<{ paymentUrl: string; sessionKey: string }>>(
    '/payments/initiate',
    { bookingId, trackingToken },
  );
  if (!response.data.success || !response.data.data?.paymentUrl) {
    throw new Error(response.data.message || 'Failed to start secure payment');
  }
  return response.data.data.paymentUrl;
}

export interface PublicBookingTracking {
  bookingNumber: string;
  status: string;
  trackingNumber: string | null;
  courierProvider: string | null;
  courierStatus: string | null;
  timeline: Array<{ status: string; label: string; at: string; type: 'business' | 'courier' }>;
  rentalPeriod: null | {
    startDate: string;
    endDate: string;
    totalDays: number;
    daysRemaining: number;
    isActive: boolean;
    isOverdue: boolean;
  };
  items: Array<{ productName: string; startDate: string; endDate: string }>;
}

/**
 * Public route to discover tracking status of a booking.
 *
 * GET /api/v1/bookings/:bookingNumber/status
 */
export async function trackBooking(trackingToken: string): Promise<PublicBookingTracking> {
  const response = await apiClient.get<ApiResponse<PublicBookingTracking>>(
    `/bookings/track/${encodeURIComponent(trackingToken)}`,
  );
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to track booking');
  }
  return response.data.data;
}
