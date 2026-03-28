import apiClient from '@/lib/api-client';
import { ApiResponse } from '@closetrent/types';

export interface CartValidationRequest {
  items: Array<{
    productId: string;
    variantId?: string;
    startDate: string;
    endDate: string;
    services: {
      tryOn: boolean;
      backupSize?: string | null;
    };
  }>;
}

export interface CartValidationResponse {
  isValid: boolean;
  messages: string[];
  updatedTotals: {
    rentalDelta: number;
    depositDelta: number;
    feesDelta: number;
    grandTotal: number;
  };
}

export interface CheckoutCustomerPayload {
  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address: string;
  area: string;
  thana?: string;
  district: string;
}

export interface CheckoutPayload {
  customer: CheckoutCustomerPayload;
  items: Array<{
    productId: string;
    variantId?: string;
    startDate: string;
    endDate: string;
    tryOn: boolean;
    backupSize?: string | null;
  }>;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'sslcommerz';
  transactionId?: string;
  notes?: string;
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
 */
export async function lookupCustomer(phone: string): Promise<Partial<CheckoutCustomerPayload> | null> {
  try {
    const response = await apiClient.get<ApiResponse<Partial<CheckoutCustomerPayload>>>(`/customers/lookup?phone=${encodeURIComponent(phone)}`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    // Graceful fail for auto-lookup. Just means they're a new customer or not found.
    return null;
  }
}

/**
 * Finalizes the order submission to the server.
 */
export async function createBooking(payload: CheckoutPayload): Promise<BookingResponse> {
  const response = await apiClient.post<ApiResponse<BookingResponse>>('/bookings', payload);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to submit booking');
  }
  return response.data.data;
}

/**
 * Public route to discover tracking status of any booking utilizing the booking ID and customer phone check.
 */
export async function trackBooking(bookingNumber: string, phone: string): Promise<any> {
  const response = await apiClient.get<ApiResponse<any>>(`/bookings/track?number=${encodeURIComponent(bookingNumber)}&phone=${encodeURIComponent(phone)}`);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch tracking details');
  }
  return response.data.data;
}
