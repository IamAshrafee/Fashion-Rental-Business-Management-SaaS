import apiClient from '@/lib/api-client';
import { Session, LoginEvent, ApiResponse, PaginatedResponse } from '@closetrent/types';

export const sessionApi = {
  // Current user sessions
  listMySessions: async () => {
    const { data } = await apiClient.get<ApiResponse<Session[]>>('/sessions');
    return data;
  },

  revokeMySession: async (sessionId: string) => {
    const { data } = await apiClient.delete<ApiResponse<void>>(`/sessions/${sessionId}`);
    return data;
  },

  revokeAllMyOtherSessions: async () => {
    const { data } = await apiClient.delete<ApiResponse<{ message: string; revokedCount: number }>>('/sessions/others');
    return data;
  },

  // Login History
  getLoginHistory: async (params?: { page?: number; limit?: number }) => {
    const { data } = await apiClient.get<PaginatedResponse<LoginEvent>>('/sessions/history', { params });
    return data;
  },

  // Tenant/Staff sessions (Owner oversight)
  listTenantSessions: async () => {
    const { data } = await apiClient.get<ApiResponse<Session[]>>('/sessions/tenant');
    return data;
  },

  revokeStaffSession: async (sessionId: string) => {
    const { data } = await apiClient.delete<ApiResponse<void>>(`/sessions/tenant/${sessionId}`);
    return data;
  },
};
