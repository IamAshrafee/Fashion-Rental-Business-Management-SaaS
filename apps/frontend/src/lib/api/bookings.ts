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

// ─── Booking Detail (richer than list item) ──────────────────────────────────

export interface BookingDetailItem {
  id: string;
  bookingId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string | null;
  colorName: string;
  sizeInfo: string | null;
  featuredImageUrl: string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  baseRental: number;
  extendedDays: number;
  extendedCost: number;
  depositAmount: number;
  depositStatus: string;
  depositRefundAmount: number | null;
  depositRefundDate: string | null;
  depositRefundMethod: string | null;
  cleaningFee: number;
  backupSize: string | null;
  backupSizeFee: number;
  tryOnFee: number;
  tryOnCredited: boolean;
  itemTotal: number;
  lateFee: number;
  lateDays: number;
  createdAt: string;
  updatedAt: string;
  damageReport: {
    id: string;
    damageLevel: string;
    description: string;
    estimatedRepairCost: number | null;
    deductionAmount: number;
    additionalCharge: number;
    photos: string[];
    reportedBy: string;
    createdAt: string;
  } | null;
}

export interface BookingDetailPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  transactionId: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface BookingDetailResponse {
  id: string;
  tenantId: string;
  bookingNumber: string;
  customerId: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  totalFees: number;
  shippingFee: number;
  totalDeposit: number;
  grandTotal: number;
  totalPaid: number;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAltPhone: string | null;
  deliveryAddressLine1: string;
  deliveryAddressLine2: string | null;
  deliveryCity: string;
  deliveryState: string | null;
  deliveryPostalCode: string | null;
  deliveryCountry: string;
  deliveryExtra: Record<string, string> | null;
  customerNotes: string | null;
  internalNotes: string | null;
  trackingNumber: string | null;
  courierProvider: string | null;
  courierStatus: string | null;
  courierStatusHistory: any;
  pickupRequestedAt: string | null;
  scheduledPickupAt: string | null;
  deliveryLeadDays: number | null;
  courierErrorReason: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  confirmedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string;
    phone: string;
    altPhone: string | null;
    email: string | null;
    totalBookings: number;
    totalSpent: number;
    tags: Array<{ id: string; tag: string }>;
  };
  items: BookingDetailItem[];
  payments: BookingDetailPayment[];
}

// ─── Cart Validation ─────────────────────────────────────────────────────────

export interface ValidateCartPayload {
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

export interface ValidatedCartItem {
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
}

export interface ValidateCartResponse {
  valid: boolean;
  items: ValidatedCartItem[];
  summary: {
    subtotal: number;
    totalFees: number;
    totalDeposit: number;
    shippingFee: number;
    grandTotal: number;
  };
}

// ─── Availability Check ──────────────────────────────────────────────────────

export interface DateRangeCheckResponse {
  available: boolean;
  conflictDates?: [string, string];
  nextAvailable?: string;
  rentalDays?: number;
  pricing?: {
    baseRental: number;
    extendedDays: number;
    extendedCost: number;
    deposit: number;
    cleaningFee: number;
    shippingFee: number;
    total: number;
  };
  reason?: string;
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
  /** Filter by item rental dates — items ending on or after this date */
  itemDateFrom?: string;
  /** Filter by item rental dates — items starting on or before this date */
  itemDateTo?: string;
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
   * POST /api/v1/bookings/validate
   * Validates cart items and returns accurate pricing. Used pre-checkout.
   */
  validateCart: async (payload: ValidateCartPayload): Promise<ValidateCartResponse> => {
    const { data } = await apiClient.post<ApiResponse<ValidateCartResponse>>(
      '/bookings/validate',
      payload,
      { withCredentials: true },
    );
    if (!data.success) throw new Error(data.message || 'Cart validation failed');
    return data.data;
  },

  /**
   * POST /api/v1/products/:productId/check-availability
   * Checks if a specific date range is available for a product and returns pricing.
   */
  checkDateRange: async (
    productId: string,
    startDate: string,
    endDate: string,
  ): Promise<DateRangeCheckResponse> => {
    const { data } = await apiClient.post<ApiResponse<DateRangeCheckResponse>>(
      `/products/${productId}/check-availability`,
      { startDate, endDate },
      { withCredentials: true },
    );
    if (!data.success) throw new Error(data.message || 'Availability check failed');
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
   * Returns full booking detail with items, customer, payments.
   */
  getById: async (id: string): Promise<BookingDetailResponse> => {
    const { data } = await apiClient.get<ApiResponse<BookingDetailResponse>>(`/owner/bookings/${id}`);
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
   * PATCH /api/v1/owner/bookings/:id/deliver
   */
  deliver: async (id: string): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/deliver`);
  },

  /**
   * PATCH /api/v1/owner/bookings/:id/return
   */
  markReturned: async (id: string): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/return`);
  },

  /**
   * PATCH /api/v1/owner/bookings/:id/inspect
   */
  inspect: async (id: string): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/inspect`);
  },

  /**
   * PATCH /api/v1/owner/bookings/:id/complete
   */
  complete: async (id: string): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${id}/complete`);
  },

  /**
   * POST /api/v1/owner/bookings/:id/notes
   */
  addNote: async (id: string, note: string): Promise<void> => {
    await apiClient.post(`/owner/bookings/${id}/notes`, { note });
  },

  /**
   * POST /api/v1/owner/bookings/:id/items/:itemId/damage
   */
  reportDamage: async (id: string, itemId: string, payload: {
    damageLevel: string;
    description: string;
    estimatedRepairCost?: number;
    deductionAmount: number;
    additionalCharge: number;
    photos?: string[];
  }): Promise<void> => {
    await apiClient.post(`/owner/bookings/${id}/items/${itemId}/damage`, payload);
  },

  /**
   * POST /api/v1/owner/bookings/:id/payments
   */
  recordPayment: async (id: string, payload: {
    amount: number;
    method: string;
    transactionId?: string;
    notes?: string;
  }): Promise<void> => {
    await apiClient.post(`/owner/bookings/${id}/payments`, payload);
  },

  /**
   * GET /api/v1/owner/bookings/:id/payments
   */
  getPayments: async (id: string): Promise<Array<{
    id: string;
    amount: number;
    method: string;
    status: string;
    transactionId?: string;
    notes?: string;
    createdAt: string;
  }>> => {
    const { data } = await apiClient.get<ApiResponse<Array<{
      id: string;
      amount: number;
      method: string;
      status: string;
      transactionId?: string;
      notes?: string;
      createdAt: string;
    }>>>(`/owner/bookings/${id}/payments`);
    if (!data.success) throw new Error(data.message || 'Failed to load payments');
    return data.data;
  },

  // ── Deposit Management ──────────────────────────────────────────────────

  /**
   * PATCH /api/v1/owner/booking-items/:itemId/deposit/collect
   * Marks a booking item's deposit as collected.
   */
  collectDeposit: async (itemId: string): Promise<void> => {
    await apiClient.patch(`/owner/booking-items/${itemId}/deposit/collect`);
  },

  /**
   * PATCH /api/v1/owner/booking-items/:itemId/deposit/refund
   * Processes a deposit refund (full or partial).
   */
  refundDeposit: async (itemId: string, payload: {
    refundAmount: number;
    refundMethod: string;
    notes?: string;
  }): Promise<void> => {
    await apiClient.patch(`/owner/booking-items/${itemId}/deposit/refund`, payload);
  },

  /**
   * PATCH /api/v1/owner/booking-items/:itemId/deposit/forfeit
   * Forfeits a deposit entirely (damage or loss).
   */
  forfeitDeposit: async (itemId: string, payload: {
    reason: string;
  }): Promise<void> => {
    await apiClient.patch(`/owner/booking-items/${itemId}/deposit/forfeit`, payload);
  },

  /**
   * POST /api/v1/owner/upload/damage-photos
   * Uploads up to 4 damage photos to MinIO and returns their public URLs.
   */
  uploadDamagePhotos: async (bookingItemId: string, files: File[]): Promise<string[]> => {
    const formData = new FormData();
    formData.append('bookingItemId', bookingItemId);
    files.forEach((file) => formData.append('files', file));

    const { data } = await apiClient.post<ApiResponse<{ urls: string[] }>>(
      '/owner/upload/damage-photos',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    if (!data.success) throw new Error(data.message || 'Failed to upload damage photos');
    return data.data.urls;
  },

  /**
   * POST /api/v1/owner/bookings/:id/late-fees
   * Calculates and updates late fees for all items in a booking.
   */
  calculateLateFees: async (id: string): Promise<{ bookingId: string; lateItemsUpdated: number }> => {
    const { data } = await apiClient.post<ApiResponse<{ bookingId: string; lateItemsUpdated: number }>>(
      `/owner/bookings/${id}/late-fees`,
    );
    if (!data.success) throw new Error(data.message || 'Failed to calculate late fees');
    return data.data;
  },
};
