import apiClient from '@/lib/api-client';
import { Customer, CustomerDetail, CreateCustomerDto, UpdateCustomerDto, AddCustomerTagDto, PaginatedResponse, ApiResponse } from '@closetrent/types';

export const customerApi = {
  getCustomers: async (params?: { page?: number; limit?: number; search?: string; tag?: string; sort?: string }) => {
    // Split combined sort param "name_asc" into { sort: "name", order: "asc" }
    const apiParams: Record<string, unknown> = { ...params };
    if (params?.sort) {
      const lastUnderscore = params.sort.lastIndexOf('_');
      if (lastUnderscore > 0) {
        apiParams.sort = params.sort.substring(0, lastUnderscore);
        apiParams.order = params.sort.substring(lastUnderscore + 1);
      }
    }
    const { data } = await apiClient.get<PaginatedResponse<Customer>>('/owner/customers', { params: apiParams });
    return data;
  },

  getCustomerById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<CustomerDetail>>(`/owner/customers/${id}`);
    return data;
  },

  createCustomer: async (payload: CreateCustomerDto) => {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>('/owner/customers', payload);
    return data;
  },

  updateCustomer: async (id: string, payload: UpdateCustomerDto) => {
    const { data } = await apiClient.patch<ApiResponse<CustomerDetail>>(`/owner/customers/${id}`, payload);
    return data;
  },

  deleteCustomer: async (id: string) => {
    const { data } = await apiClient.delete<ApiResponse<unknown>>(`/owner/customers/${id}`);
    return data;
  },

  getCustomerTags: async () => {
    const { data } = await apiClient.get<string[]>('/owner/customers/tags');
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
