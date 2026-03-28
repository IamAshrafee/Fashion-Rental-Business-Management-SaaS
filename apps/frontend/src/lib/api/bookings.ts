import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse } from '@closetrent/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateBookingPayload {
  customer: {
    fullName: string;
    phone: string;
    altPhone?: string;
    email?: string;
  };
  delivery: {
    address: string;
    area?: string;
    thana?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
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
  customerNotes?: string;
  bkashTransactionId?: string;
  nagadTransactionId?: string;
}

export interface BookingCreatedResponse {
  bookingId: string;
  bookingNumber: string;
  status: string;
  paymentMethod: string;
  grandTotal: number;
  breakdown: {
    subtotal: number;
    totalFees: number;
    shippingFee: number;
    totalDeposit: number;
    grandTotal: number;
  };
  customer: { id: string; fullName: string; phone: string };
  items: Array<{
    id: string;
    productName: string;
    colorName: string;
    startDate: string;
    endDate: string;
    rentalDays: number;
    baseRental: number;
    depositAmount: number;
    itemTotal: number;
  }>;
}

export interface BookingListItem {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  deliveryName: string;
  createdAt: string;
  customer: { id: string; fullName: string; phone: string; email?: string };
  items: Array<{
    id: string;
    productName: string;
    colorName: string;
    startDate: string;
    endDate: string;
    rentalDays: number;
    itemTotal: number;
    featuredImageUrl?: string;
  }>;
  _count: { items: number };
}

export interface BookingStats {
  pendingCount: number;
  overdueCount: number;
  todayDeliveries: number;
  totalActive: number;
  recentBookings: Array<{
    id: string;
    bookingNumber: string;
    status: string;
    grandTotal: number;
    deliveryName: string;
    createdAt: string;
  }>;
}

export interface BookingListQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: string;
  customerId?: string;
  order?: 'asc' | 'desc';
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const bookingApi = {
  /**
   * POST /api/v1/bookings
   * Creates a new booking (public endpoint — used for both guest and owner).
   * The owner form uses this directly since the backend handles find-or-create customer.
   */
  create: async (payload: CreateBookingPayload): Promise<BookingCreatedResponse> => {
    const { data } = await apiClient.post<ApiResponse<BookingCreatedResponse>>(
      '/bookings',
      payload,
      { withCredentials: true },
    );
    if (!data.success) throw new Error(data.message || 'Failed to create booking');
    return data.data;
  },

  /**
   * GET /api/v1/owner/bookings/stats
   */
  getStats: async (): Promise<BookingStats> => {
    const { data } = await apiClient.get<ApiResponse<BookingStats>>('/owner/bookings/stats');
    if (!data.success) throw new Error(data.message || 'Failed to load stats');
    return data.data;
  },

  /**
   * GET /api/v1/owner/bookings
   */
  list: async (query?: BookingListQuery): Promise<PaginatedResponse<BookingListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<BookingListItem>>(
      '/owner/bookings',
      { params: query },
    );
    return data;
  },

  /**
   * GET /api/v1/owner/bookings/:id
   */
  getById: async (id: string): Promise<BookingListItem> => {
    const { data } = await apiClient.get<ApiResponse<BookingListItem>>(`/owner/bookings/${id}`);
    if (!data.success) throw new Error(data.message || 'Booking not found');
    return data.data;
  },

  /**
   * PATCH /api/v1/owner/bookings/:id/confirm
   */
  confirm: async (id: string): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/confirm`);
  },

  /**
   * PATCH /api/v1/owner/bookings/:id/cancel
   */
  cancel: async (id: string, reason: string): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/cancel`, { reason });
  },

  /**
   * PATCH /api/v1/owner/bookings/:id/ship
   */
  ship: async (id: string, payload: { courierProvider?: string; trackingNumber?: string }): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/ship`, payload);
  },
};
