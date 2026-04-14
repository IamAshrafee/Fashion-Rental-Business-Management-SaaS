import apiClient from '@/lib/api-client';
import { AnalyticsSummary, RevenueSeries, CategoryRevenue, TopProduct, TargetRecoverySummary, ApiResponse, StorefrontEventPayload, StorefrontTrafficSummary, TrafficFunnel, TopViewedProduct, AttributionSource } from '@closetrent/types';

export const analyticsApi = {
  getSummary: async (params?: { from?: string; to?: string }) => {
    const { data } = await apiClient.get<ApiResponse<AnalyticsSummary>>('/owner/analytics/summary', { params });
    return data;
  },

  getRevenueSeries: async (params?: { from?: string; to?: string; groupBy?: string }) => {
    const { data } = await apiClient.get<ApiResponse<RevenueSeries>>('/owner/analytics/revenue', { params });
    return data;
  },

  getCategoryRevenue: async () => {
    const { data } = await apiClient.get<ApiResponse<CategoryRevenue[]>>('/owner/analytics/revenue-by-category');
    return data;
  },

  getTopProducts: async (params?: { sortBy?: 'bookings' | 'revenue'; limit?: number }) => {
    const { data } = await apiClient.get<ApiResponse<TopProduct[]>>('/owner/analytics/top-products', { params });
    return data;
  },

  getTargetRecovery: async () => {
    const { data } = await apiClient.get<ApiResponse<TargetRecoverySummary>>('/owner/analytics/target-recovery');
    return data;
  },

  // ----------------------------------------------------------------------
  // Storefront Traffic Funnel Analytics
  // ----------------------------------------------------------------------

  getStorefrontSummary: async (params?: { from?: string; to?: string; productId?: string }) => {
    const { data } = await apiClient.get<ApiResponse<StorefrontTrafficSummary>>('/owner/analytics/traffic/summary', { params });
    return data;
  },

  getFunnelMetrics: async (params?: { from?: string; to?: string; productId?: string }) => {
    const { data } = await apiClient.get<ApiResponse<TrafficFunnel>>('/owner/analytics/traffic/funnel', { params });
    return data;
  },

  getTopViewedProducts: async (params?: { from?: string; to?: string }) => {
    const { data } = await apiClient.get<ApiResponse<TopViewedProduct[]>>('/owner/analytics/traffic/top-products', { params });
    return data;
  },

  getMarketingAttribution: async (params?: { from?: string; to?: string }) => {
    const { data } = await apiClient.get<ApiResponse<AttributionSource[]>>('/owner/analytics/traffic/attribution', { params });
    return data;
  },

  /**
   * Fire and forget tracking function for guest storefront events.
   * Utilizes navigator.sendBeacon safely for immediate delivery unhindered by page loads.
   */
  trackStorefrontEvent: async (
    payload: StorefrontEventPayload,
    useBeacon: boolean = false
  ): Promise<void> => {
    try {
      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // We use relative URL or dynamically pulled baseURL
        const baseUrl = apiClient.defaults.baseURL || '/api/v1';
        const endpoint = `${baseUrl}/analytics/events`;
        
        // sendBeacon requires exactly Blob for application/json
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // Standard Axios call 
        apiClient.post('/analytics/events', payload).catch(() => {
          // Strictly silent failure for guest metrics
        });
      }
    } catch {
      // Complete safety catch
    }
  },
};
