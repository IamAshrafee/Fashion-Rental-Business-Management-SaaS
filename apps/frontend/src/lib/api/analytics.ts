import apiClient from '@/lib/api-client';
import { AnalyticsSummary, RevenueSeries, CategoryRevenue, TopProduct, TargetRecoverySummary, ApiResponse } from '@closetrent/types';

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
};
