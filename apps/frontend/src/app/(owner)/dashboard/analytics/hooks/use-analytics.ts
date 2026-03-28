import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';

export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: (params: Record<string, any>) => [...analyticsKeys.all, 'summary', params] as const,
  revenueSeries: (params: Record<string, any>) => [...analyticsKeys.all, 'revenue', params] as const,
  categoryRevenue: () => [...analyticsKeys.all, 'category'] as const,
  topProducts: (params: Record<string, any>) => [...analyticsKeys.all, 'top-products', params] as const,
  targetRecovery: () => [...analyticsKeys.all, 'target-recovery'] as const,
};

export function useAnalyticsSummary(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: analyticsKeys.summary(params),
    queryFn: () => analyticsApi.getSummary(params),
  });
}

export function useRevenueSeries(params: { from?: string; to?: string; groupBy?: string } = {}) {
  return useQuery({
    queryKey: analyticsKeys.revenueSeries(params),
    queryFn: () => analyticsApi.getRevenueSeries(params),
  });
}

export function useCategoryRevenue() {
  return useQuery({
    queryKey: analyticsKeys.categoryRevenue(),
    queryFn: () => analyticsApi.getCategoryRevenue(),
  });
}

export function useTopProducts(params: { sortBy?: 'bookings' | 'revenue'; limit?: number } = {}) {
  return useQuery({
    queryKey: analyticsKeys.topProducts(params),
    queryFn: () => analyticsApi.getTopProducts(params),
  });
}

export function useTargetRecovery() {
  return useQuery({
    queryKey: analyticsKeys.targetRecovery(),
    queryFn: () => analyticsApi.getTargetRecovery(),
  });
}
