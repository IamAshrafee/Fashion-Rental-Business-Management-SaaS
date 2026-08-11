import apiClient from '@/lib/api-client';
import {
  AddCustomerTagDto,
  ApiResponse,
  CreateCustomerDto,
  Customer,
  CustomerAddressInput,
  CustomerDetail,
  CustomerIdentityInput,
  CustomerTag,
  PaginatedResponse,
  UpdateCustomerDto,
} from '@closetrent/types';

export type CustomerListParams = {
  page?: number;
  limit?: number;
  search?: string;
  tagId?: string;
  status?: string;
  hasAccount?: boolean;
  sort?: string;
};

export const customerApi = {
  async getCustomers(params?: CustomerListParams) {
    const apiParams: Record<string, unknown> = { ...params };
    if (params?.sort) {
      const splitAt = params.sort.lastIndexOf('_');
      if (splitAt > 0) {
        apiParams.sort = params.sort.slice(0, splitAt);
        apiParams.order = params.sort.slice(splitAt + 1);
      }
    }
    const { data } = await apiClient.get<PaginatedResponse<Customer>>('/owner/customers', { params: apiParams });
    return data;
  },

  async getCustomerById(id: string) {
    const { data } = await apiClient.get<ApiResponse<CustomerDetail>>(`/owner/customers/${id}`);
    return data;
  },

  async createCustomer(payload: CreateCustomerDto) {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>('/owner/customers', payload);
    return data;
  },

  async updateCustomer(id: string, payload: UpdateCustomerDto) {
    const { data } = await apiClient.patch<ApiResponse<CustomerDetail>>(`/owner/customers/${id}`, payload);
    return data;
  },

  async archiveCustomer(id: string) {
    const { data } = await apiClient.delete<ApiResponse<{ id: string; status: string }>>(`/owner/customers/${id}`);
    return data;
  },

  async anonymizeCustomer(id: string) {
    const { data } = await apiClient.post<ApiResponse<{ id: string; status: string }>>(`/owner/customers/${id}/anonymize`);
    return data;
  },

  async mergeCustomer(targetId: string, sourceCustomerId: string) {
    const { data } = await apiClient.post<ApiResponse<unknown>>(`/owner/customers/${targetId}/merge`, { sourceCustomerId });
    return data;
  },

  async getCustomerTags() {
    const { data } = await apiClient.get<ApiResponse<CustomerTag[]>>('/owner/customers/tags');
    return data;
  },

  async createCustomerTag(payload: { name: string; color?: string }) {
    const { data } = await apiClient.post<ApiResponse<CustomerTag>>('/owner/customers/tags', payload);
    return data;
  },

  async addCustomerTag(id: string, payload: AddCustomerTagDto) {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/tags`, payload);
    return data;
  },

  async removeCustomerTag(id: string, tagId: string) {
    const { data } = await apiClient.delete<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/tags/${tagId}`);
    return data;
  },

  async addIdentity(id: string, payload: CustomerIdentityInput) {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/identities`, payload);
    return data;
  },

  async setPrimaryIdentity(id: string, identityId: string) {
    const { data } = await apiClient.patch<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/identities/primary`, { identityId });
    return data;
  },

  async removeIdentity(id: string, identityId: string) {
    const { data } = await apiClient.delete<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/identities/${identityId}`);
    return data;
  },

  async addAddress(id: string, payload: CustomerAddressInput) {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/addresses`, payload);
    return data;
  },

  async updateAddress(id: string, addressId: string, payload: Partial<CustomerAddressInput>) {
    const { data } = await apiClient.patch<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/addresses/${addressId}`, payload);
    return data;
  },

  async archiveAddress(id: string, addressId: string) {
    const { data } = await apiClient.delete<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/addresses/${addressId}`);
    return data;
  },

  async addNote(id: string, payload: { body: string; isPinned?: boolean }) {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/notes`, payload);
    return data;
  },

  async recordConsent(id: string, payload: { purpose: string; channel?: string; granted: boolean; source: string }) {
    const { data } = await apiClient.post<ApiResponse<CustomerDetail>>(`/owner/customers/${id}/consents`, payload);
    return data;
  },
};
