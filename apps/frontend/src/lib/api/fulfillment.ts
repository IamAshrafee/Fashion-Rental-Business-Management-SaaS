import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryItem {
  id: string;
  bookingNumber: string;
  status: string;
  courierProvider: string | null;
  courierConsignmentId: string | null;
  courierStatus: string | null;
  courierStatusHistory: Array<{
    status: string;
    label: string;
    timestamp: string;
    source: string;
  }> | null;
  trackingNumber: string | null;
  pickupRequestedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  deliveryName: string;
  deliveryPhone: string;
  deliveryCity: string;
  grandTotal: number;
  items: Array<{
    productName: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface DeliveryDashboardResponse {
  summary: Record<string, number>;
  data: DeliveryItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeliveryQuery {
  courierStatus?: string;
  page?: number;
  limit?: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const fulfillmentApi = {
  /**
   * GET /api/v1/owner/fulfillment/deliveries
   * Returns delivery dashboard data with summary counts and paginated deliveries.
   */
  getDeliveries: async (query?: DeliveryQuery): Promise<DeliveryDashboardResponse> => {
    const { data } = await apiClient.get<DeliveryDashboardResponse>(
      '/owner/fulfillment/deliveries',
      { params: query },
    );
    return data;
  },

  /**
   * POST /api/v1/owner/fulfillment/:bookingId/ship
   * Ships an order (automated API call or manual tracking)
   */
  ship: async (
    bookingId: string,
    payload: { courierProvider?: string; useApi: boolean; trackingNumber?: string }
  ): Promise<void> => {
    await apiClient.post(`/owner/fulfillment/${bookingId}/ship`, payload);
  },
};
