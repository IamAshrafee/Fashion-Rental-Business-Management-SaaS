import apiClient from '@/lib/api-client';
import {
  Staff,
  StaffInvitation,
  CreatedStaffInvitation,
  InviteStaffDto,
  UpdateStaffDto,
  StaffQueryDto,
  ApiResponse,
  PaginatedResponse,
} from '@closetrent/types';

export const staffApi = {
  listStaff: async (params?: StaffQueryDto) => {
    const { data } = await apiClient.get<PaginatedResponse<Staff>>('/staff', { params });
    return data;
  },

  getStaff: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Staff>>(`/staff/${id}`);
    return data;
  },

  inviteStaff: async (payload: InviteStaffDto) => {
    const { data } = await apiClient.post<ApiResponse<CreatedStaffInvitation>>('/staff', payload);
    return data;
  },

  listInvitations: async () => {
    const { data } = await apiClient.get<ApiResponse<StaffInvitation[]>>('/staff/invitations');
    return data;
  },

  revokeInvitation: async (id: string) => {
    const { data } = await apiClient.delete<ApiResponse<StaffInvitation>>(
      `/staff/invitations/${id}`,
    );
    return data;
  },

  acceptInvitation: async (payload: { token: string; password: string }) => {
    const { data } = await apiClient.post<ApiResponse<Staff>>('/staff/invitations/accept', payload);
    return data;
  },

  updateStaff: async (id: string, payload: UpdateStaffDto) => {
    const { data } = await apiClient.patch<ApiResponse<Staff>>(`/staff/${id}`, payload);
    return data;
  },

  removeStaff: async (id: string) => {
    const { data } = await apiClient.delete<ApiResponse<void>>(`/staff/${id}`);
    return data;
  },
};
