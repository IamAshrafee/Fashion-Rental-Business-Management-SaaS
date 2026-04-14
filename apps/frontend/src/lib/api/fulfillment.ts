import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryStage =
  | 'prepare_parcel'
  | 'awaiting_pickup'
  | 'in_transit'
  | 'delivered'
  | 'error';

export interface DeliveryItem {
  id: string;
  bookingNumber: string;
  status: string;
  deliveryStage: DeliveryStage | null;
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
  scheduledPickupAt: string | null;
  deliveryLeadDays: number | null;
  courierErrorReason: string | null;
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
  stageSummary: Record<DeliveryStage, number>;
  data: DeliveryItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeliveryQuery {
  stage?: DeliveryStage;
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
   * POST /api/v1/owner/fulfillment/:bookingId/send-pickup
   * Sends an immediate pickup request to the courier.
   */
  sendPickup: async (bookingId: string): Promise<void> => {
    await apiClient.post(`/owner/fulfillment/${bookingId}/send-pickup`);
  },

  /**
   * PATCH /api/v1/owner/fulfillment/:bookingId/stage
   * Manually transitions a delivery to a new stage.
   */
  updateStage: async (
    bookingId: string,
    payload: { stage: DeliveryStage; reason?: string },
  ): Promise<void> => {
    await apiClient.patch(`/owner/fulfillment/${bookingId}/stage`, payload);
  },
};
