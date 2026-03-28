import apiClient from '@/lib/api-client';
import { Customer, CustomerDetail, UpdateCustomerDto, AddCustomerTagDto, PaginatedResponse, ApiResponse } from '@closetrent/types';

export const customerApi = {
  getCustomers: async (params?: { page?: number; limit?: number; search?: string; tag?: string; sort?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Customer>>('/owner/customers', { params });
    return data;
  },

  getCustomerById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<CustomerDetail>>(`/owner/customers/${id}`);
    return data;
  },

  updateCustomer: async (id: string, payload: UpdateCustomerDto) => {
    const { data } = await apiClient.patch<ApiResponse<CustomerDetail>>(`/owner/customers/${id}`, payload);
    return data;
  },

  addCustomerTag: async (id: string, payload: AddCustomerTagDto) => {
    const { data } = await apiClient.post<ApiResponse<unknown>>(`/owner/customers/${id}/tags`, payload);
    return data;
  },

  removeCustomerTag: async (id: string, tag: string) => {
    const { data } = await apiClient.delete<ApiResponse<unknown>>(`/owner/customers/${id}/tags/${encodeURIComponent(tag)}`);
    return data;
  },
};
