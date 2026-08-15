import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { hasTenantPermission } from '@/lib/permissions';

export interface DashboardStats {
  pendingCount: number;
  overdueCount: number;
  todayDeliveries: number;
  totalActive: number;
  bookedRentalValueThisMonth: number;
  bookedValueChangePercent: number | null;
  bookingValueChart: Array<{
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
  setupReadiness: {
    branding: boolean;
    category: boolean;
    publishedProduct: boolean;
    physicalInventory: boolean;
    payment: boolean;
    delivery: boolean;
  };
}

export function useBookingStats() {
  const { tenantId, user } = useAuth();
  const canManageBookings = hasTenantPermission(user, 'manage_bookings');
  
  return useQuery({
    queryKey: ['owner', 'bookings', 'stats', tenantId],
    enabled: Boolean(tenantId && canManageBookings),
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: DashboardStats }>('/owner/bookings/stats');
      return response.data.data;
    },
  });
}
