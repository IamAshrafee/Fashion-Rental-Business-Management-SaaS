import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse } from '@closetrent/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManualRentalPlan {
  startDate: string;
  endDate: string;
  sourceLocationId: string;
  handoverMethod: 'DELIVERY' | 'CUSTOMER_PICKUP';
  returnMethod: 'BUSINESS_PICKUP' | 'CUSTOMER_RETURN';
  handoverNotes?: string;
  allowTransferPlan?: boolean;
}

export interface ManualBookingItemInput {
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
  priceOverride?: number;
  priceOverrideReason?: string;
}

export interface ManualBookingDiscount {
  type: 'flat' | 'percentage';
  value: number;
  reason: string;
}

export interface CreateManualBookingPayload {
  quoteId: string;
  quoteHash: string;
  plan: ManualRentalPlan;
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
    // Delivery recipient override (may differ from customer)
    deliveryName?: string;
    deliveryPhone?: string;
    deliveryAltPhone?: string;
  };
  items: ManualBookingItemInput[];
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'sslcommerz';
  customerNotes?: string;
  bkashTransactionId?: string;
  nagadTransactionId?: string;
  // ── Manual booking power-ups ──
  /** Internal notes visible only to tenant staff */
  internalNotes?: string;
  /** Record an upfront payment atomically with the booking */
  initialPayment?: {
    amount: number;
    depositAmount?: number;
    method: 'cod' | 'bkash' | 'nagad' | 'sslcommerz';
    transactionId?: string;
    notes?: string;
  };
  /** Discount applied to the order */
  discount?: ManualBookingDiscount;
}

export interface ManualBookingQuoteResponse {
  valid: boolean;
  quoteId: string | null;
  quoteHash: string | null;
  expiresAt: string | null;
  location: { id: string; code: string; name: string; canCustomerPickup: boolean };
  plan: ManualRentalPlan;
  lines: Array<{
    lineId: string;
    productId: string;
    variantId: string;
    variantSizeId: string;
    productName: string;
    quantity: number;
    rentalDays: number;
    quotedItemTotal: number;
    priceOverrideAmount: number | null;
    priceOverrideReason: string | null;
    finalItemTotal: number;
    depositAmount: number;
    fees: { cleaning: number; backupSize: number; tryOn: number; shipping: number };
    policyVersionId: string;
  }>;
  availabilityPlan: Array<{
    lineId: string;
    requirementKey: string;
    productId: string;
    variantSizeId: string;
    quantity: number;
    sourceLocationId: string | null;
    sourceLocationName: string;
    blockedRange: { start: string; end: string };
    remainingQuantity: number;
    transferRequired: boolean;
    transferFromLocationId?: string;
    transferFromLocationName?: string;
  }>;
  totals: {
    subtotal: number;
    totalFees: number;
    totalDeposit: number;
    shippingFee: number;
    discountAmount: number;
    grandTotal: number;
  };
  conflicts: Array<{
    code: string;
    lineId: string;
    productId?: string;
    variantSizeId?: string;
    requestedQuantity?: number;
    remainingQuantity?: number;
    transferRequired?: boolean;
    transferFromLocationId?: string;
    message: string;
  }>;
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
    discountAmount: number;
    grandTotal: number;
  };
  customer: { id: string; fullName: string; primaryPhone: string | null };
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
  payments: Array<{
    id: string;
    amount: number;
    method: 'cod' | 'bkash' | 'nagad';
    status: string;
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
  customer: { id: string; fullName: string; primaryPhone: string | null; primaryEmail: string | null };
  items: Array<{
    id: string;
    productName: string;
    colorName: string;
    startDate: string;
    endDate: string;
    rentalDays: number;
    itemTotal: number;
    featuredImageUrl?: string;
    quantity: number;
  }>;
  _count: { items: number };
  operations: {
    rentalStartDate: string | null;
    rentalEndDate: string | null;
    totalQuantity: number;
    requirementCount: number;
    inventoryShortages: number;
    physicalItemRequired: number;
    physicalItemAssigned: number;
    needsAssignment: boolean;
    preparationReady: boolean;
    handedOutQuantity: number;
    returnedQuantity: number;
    lostQuantity: number;
    unresolvedReturnQuantity: number;
    inspectionOutstanding: number;
    unsettledDepositCount: number;
    unresolvedIssueCount: number;
    balanceDue: number;
    sourceLocation: { id: string; code: string; name: string } | null;
    handoverMethod: 'DELIVERY' | 'CUSTOMER_PICKUP' | null;
    returnMethod: 'BUSINESS_PICKUP' | 'CUSTOMER_RETURN' | null;
    blockers: string[];
    nextAction: 'REVIEW' | 'ASSIGN_ITEMS' | 'PREPARE' | 'HAND_OUT' | 'START_RENTAL' | 'RECEIVE_RETURN' | 'INSPECT' | 'REVIEW_RETURN' | 'SETTLE_DEPOSIT' | 'COLLECT_BALANCE' | 'RESOLVE_RETURN_WORK' | 'COMPLETE' | 'NONE';
  };
}

export interface BookingCalendarItem {
  id: string;
  bookingNumber: string;
  status: string;
  customer: { id: string; fullName: string; primaryPhone: string | null };
  items: Array<{ id: string; productName: string; startDate: string; endDate: string }>;
}

// ─── Booking Detail (richer than list item) ──────────────────────────────────

export interface BookingDetailItem {
  id: string;
  bookingId: string;
  productId: string;
  variantId: string;
  variantSizeId: string | null;
  quantity: number;
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
  fulfillmentAdjustment: number;
  lateFee: number;
  lateDays: number;
  createdAt: string;
  updatedAt: string;
  variantSize?: {
    id: string;
    sizeInstance: { displayLabel: string };
  } | null;
  fulfillmentRequirements?: Array<{
    id: string;
    role: string;
    status: string;
    productNameSnapshot: string;
    sizeSnapshot: string | null;
    quantity: number;
  }>;
  stockUnitIssues: Array<{
    id: string;
    issueType: string;
    severity: string;
    status: string;
    responsibility: string;
    description: string;
    estimatedCost: number | null;
    customerCharge: number | null;
    assignmentId: string | null;
    inspectionId: string | null;
    stockUnit: { id: string; assetCode: string };
  }>;
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
  depositSettlement: {
    id: string;
    refundAmount: number;
    deductionAmount: number;
    forfeitedAmount: number;
    additionalCharge: number;
    refundMethod: string | null;
    reason: string;
    actorUserId: string;
    createdAt: string;
  } | null;
}

export interface BookingDetailPayment {
  id: string;
  amount: number;
  rentalAmount: number;
  depositAmount: number;
  method: string;
  status: string;
  transactionId: string | null;
  notes: string | null;
  recordedBy: string | null;
  recorder: { id: string; fullName: string } | null;
  createdAt: string;
}

export interface BookingDetailResponse {
  id: string;
  tenantId: string;
  bookingNumber: string;
  channel: 'STOREFRONT' | 'OWNER_MANUAL';
  quoteId: string | null;
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  sourceLocationId: string | null;
  handoverMethod: 'DELIVERY' | 'CUSTOMER_PICKUP' | null;
  returnMethod: 'BUSINESS_PICKUP' | 'CUSTOMER_RETURN' | null;
  sourceLocation: { id: string; code: string; name: string; timezone: string } | null;
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
  discountAmount: number;
  discountType: string | null;
  discountReason: string | null;
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
  courierStatusHistory: Array<{
    status: string;
    label: string;
    timestamp: string;
    source?: string;
  }> | null;
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
    primaryPhone: string | null;
    primaryEmail: string | null;
    identities: Array<{ id: string; kind: 'phone' | 'email'; value: string; isPrimary: boolean }>;
    totalBookings: number;
    totalSpent: number;
    tags: Array<{ id: string; name: string; color: string | null }>;
  };
  operations: BookingListItem['operations'];
  items: BookingDetailItem[];
  payments: BookingDetailPayment[];
  fulfillmentExtensions: Array<{
    id: string;
    previousEndDate: string;
    rentalEndDate: string;
    extensionCharge: number;
    approvalEvidence: string;
    reason: string;
    createdAt: string;
    actor: { id: string; fullName: string };
  }>;
  operationalTimeline: {
    events: Array<{
      id: string;
      category: 'BOOKING' | 'COURIER' | 'FULFILLMENT' | 'COMMERCIAL' | 'RETURN';
      code: string;
      label: string;
      occurredAt: string;
      actor: { id: string; fullName: string } | null;
      reason: string | null;
      amountMinor: number | null;
      metadata?: Record<string, unknown>;
    }>;
    truncated: boolean;
    limit: number;
  };
}

// ─── Cart Validation ─────────────────────────────────────────────────────────

export interface ValidateCartPayload {
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
  needsAssignmentCount: number;
  todayHandoffs: number;
  todayReturns: number;
  todayDeliveries: number;
  totalActive: number;
  queueCounts: Record<'ALL' | 'REQUEST' | 'ASSIGNMENT' | 'PREPARATION' | 'HANDOFF' | 'ACTIVE' | 'RETURN_DUE' | 'RETURN_INTAKE' | 'INSPECTION' | 'EXCEPTION' | 'CLOSED', number>;
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
  queue?: 'REQUEST' | 'ASSIGNMENT' | 'PREPARATION' | 'HANDOFF' | 'ACTIVE' | 'RETURN_DUE' | 'RETURN_INTAKE' | 'INSPECTION' | 'EXCEPTION' | 'CLOSED';
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
  sort?: 'createdAt' | 'grandTotal';
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const bookingApi = {
  /** Creates a staff booking from an unexpired authoritative owner quote. */
  createManual: async (payload: CreateManualBookingPayload, creationKey?: string): Promise<BookingCreatedResponse> => {
    const { data } = await apiClient.post<ApiResponse<BookingCreatedResponse>>(
      '/owner/bookings',
      payload,
      {
        withCredentials: true,
        headers: creationKey ? { 'Idempotency-Key': creationKey } : undefined,
      },
    );
    if (!data.success) throw new Error(data.message || 'Failed to create booking');
    return data.data;
  },

  quoteManual: async (payload: {
    plan: ManualRentalPlan;
    items: ManualBookingItemInput[];
    discount?: ManualBookingDiscount;
  }): Promise<ManualBookingQuoteResponse> => {
    const { data } = await apiClient.post<ApiResponse<ManualBookingQuoteResponse>>('/owner/bookings/quote', payload);
    if (!data.success) throw new Error(data.message || 'Failed to quote booking');
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
    variantSizeId: string,
    startDate: string,
    endDate: string,
    quantity = 1,
  ): Promise<DateRangeCheckResponse> => {
    const { data } = await apiClient.post<ApiResponse<DateRangeCheckResponse>>(
      `/products/${productId}/check-availability`,
      { variantSizeId, startDate, endDate, quantity },
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

  calendar: async (startDate: string, endDate: string): Promise<BookingCalendarItem[]> => {
    const { data } = await apiClient.get<ApiResponse<BookingCalendarItem[]>>('/owner/bookings/calendar', {
      params: { startDate, endDate },
    });
    if (!data.success) throw new Error(data.message || 'Failed to load rental calendar');
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
    stockUnitIssueId?: string;
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
    depositAmount?: number;
    method: string;
    transactionId?: string;
    notes?: string;
  }, idempotencyKey: string): Promise<void> => {
    await apiClient.post(`/owner/bookings/${id}/payments`, payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  reviewPaymentClaim: async (
    bookingId: string,
    paymentId: string,
    payload: { approve: boolean; reason?: string },
  ): Promise<void> => {
    await apiClient.patch(`/owner/bookings/${bookingId}/payments/${paymentId}/review`, payload);
  },

  /**
   * GET /api/v1/owner/bookings/:id/payments
   */
  getPayments: async (id: string): Promise<Array<{
    id: string;
    amount: number;
    rentalAmount: number;
    depositAmount: number;
    method: string;
    status: string;
    transactionId?: string;
    notes?: string;
    createdAt: string;
  }>> => {
    const { data } = await apiClient.get<ApiResponse<Array<{
      id: string;
      amount: number;
      rentalAmount: number;
      depositAmount: number;
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

  /** Atomically closes one item's held security deposit. */
  settleDeposit: async (itemId: string, payload: {
    forfeit: boolean;
    refundAmount: number;
    deductionAmount: number;
    additionalCharge?: number;
    refundMethod?: string;
    reason: string;
    damageReportId?: string;
  }, idempotencyKey: string): Promise<void> => {
    await apiClient.patch(`/owner/booking-items/${itemId}/deposit/settle`, payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
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
