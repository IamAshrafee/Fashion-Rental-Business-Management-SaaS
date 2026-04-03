import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

export interface DashboardStats {
  pendingCount: number;
  overdueCount: number;
  todayDeliveries: number;
  totalActive: number;
  revenueThisMonth: number;
  revenueChart: Array<{
    date: string;
    revenue: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    image: string | null;
    count: number;
  }>;
  recentBookings: Array<{
    id: string;
    bookingNumber: string;
    status: string;
    grandTotal: number;
    deliveryName: string;
    createdAt: string;
  }>;
}

export function useBookingStats() {
  const { tenantId } = useAuth();
  
  return useQuery({
    queryKey: ['owner', 'bookings', 'stats', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: DashboardStats }>('/owner/bookings/stats');
      return response.data.data;
    },
  });
}
