import apiClient from '@/lib/api-client';
import { ApiResponse } from '@closetrent/types';

// ─── Cart Validation ─────────────────────────────────────────────────────────

export interface CartValidationRequest {
  items: Array<{
    productId: string;
    variantId: string;
    startDate: string;
    endDate: string;
    selectedSize?: string;
    backupSize?: string;
    tryOn?: boolean;
  }>;
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
  }>;
  summary: {
    subtotal: number;
    totalFees: number;
    totalDeposit: number;
    shippingFee: number;
    grandTotal: number;
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
    startDate: string;
    endDate: string;
    selectedSize?: string;
    backupSize?: string;
    tryOn?: boolean;
  }>;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'sslcommerz';
  bkashTransactionId?: string;
  nagadTransactionId?: string;
  customerNotes?: string;
}

export interface BookingResponse {
  bookingId: string;
  bookingNumber: string;
  status: string;
  paymentUrl?: string; // If sslcommerz
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
 * Looks up existing customer details based on phone number to auto-fill checkout fields.
 *
 * GET /api/v1/customers/lookup?phone=...
 */
export async function lookupCustomer(
  phone: string,
): Promise<{
  found: boolean;
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}> {
  try {
    const response = await apiClient.get<{
      found: boolean;
      customer: any;
    }>(`/customers/lookup?phone=${encodeURIComponent(phone)}`);
    return response.data;
  } catch {
    return { found: false, customer: null };
  }
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
export async function createBooking(payload: CheckoutPayload): Promise<BookingResponse> {
  const response = await apiClient.post<ApiResponse<BookingResponse>>('/bookings', payload);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to submit booking');
  }
  return response.data.data;
}

/**
 * Public route to discover tracking status of a booking.
 *
 * GET /api/v1/bookings/:bookingNumber/status
 */
export async function trackBooking(bookingNumber: string): Promise<unknown> {
  const response = await apiClient.get<unknown>(
    `/bookings/${encodeURIComponent(bookingNumber)}/status`,
  );
  return response;
}
