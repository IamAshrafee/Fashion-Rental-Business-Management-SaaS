import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

export interface DashboardStats {
  pendingCount: number;
  overdueCount: number;
  todayDeliveries: number;
  totalActive: number;
  revenueThisMonth: number; // Placeholder for now, missing from backend
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
      const response = await apiClient.get<{ success: boolean; data: Omit<DashboardStats, 'revenueThisMonth'> }>('/owner/bookings/stats');
      
      // Inject dummy revenue until backend API provides it
      return {
        ...response.data.data,
        revenueThisMonth: 185000, 
      } as DashboardStats;
    },
  });
}
