import apiClient from '@/lib/api-client';
import {
  UpdateStoreSettingsDto,
  UpdateLocaleSettingsDto,
  UpdatePaymentSettingsDto,
  UpdateCourierSettingsDto,
  UpdateOperationalSettingsDto,
  SetCustomDomainDto,
  StoreSettings,
  ApiResponse,
} from '@closetrent/types';

export const settingsApi = {
  // Store Settings (General/Branding)
  getStoreSettings: async () => {
    const { data } = await apiClient.get<ApiResponse<StoreSettings>>('/tenant/settings');
    return data;
  },

  updateStoreSettings: async (payload: UpdateStoreSettingsDto) => {
    const { data } = await apiClient.patch<ApiResponse<StoreSettings>>('/tenant/settings', payload);
    return data;
  },

  updateLocaleSettings: async (payload: UpdateLocaleSettingsDto) => {
    const { data } = await apiClient.patch<ApiResponse<StoreSettings>>('/tenant/locale', payload);
    return data;
  },

  updatePaymentSettings: async (payload: UpdatePaymentSettingsDto) => {
    const { data } = await apiClient.patch<ApiResponse<StoreSettings>>('/tenant/payment-settings', payload);
    return data;
  },

  updateCourierSettings: async (payload: UpdateCourierSettingsDto) => {
    const { data } = await apiClient.patch<ApiResponse<StoreSettings>>('/tenant/courier-settings', payload);
    return data;
  },

  updateOperationalSettings: async (payload: UpdateOperationalSettingsDto) => {
    const { data } = await apiClient.patch<ApiResponse<StoreSettings>>('/tenant/operational-settings', payload);
    return data;
  },

  // Custom Domain
  setCustomDomain: async (payload: SetCustomDomainDto) => {
    const { data } = await apiClient.post<ApiResponse<void>>('/tenant/custom-domain', payload);
    return data;
  },

  verifyCustomDomain: async () => {
    const { data } = await apiClient.post<ApiResponse<unknown>>('/tenant/custom-domain/verify');
    return data;
  },

  removeCustomDomain: async () => {
    const { data } = await apiClient.delete<ApiResponse<void>>('/tenant/custom-domain');
    return data;
  },
  
  // Subscription Info
  getSubscription: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/tenant/subscription');
    return data;
  },

  getResourceUsage: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/tenant/resource-usage');
    return data;
  },

  getBillingHistory: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/tenant/billing-history');
    return data;
  },

  // Branding — Logo Upload
  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<ApiResponse<{ logoUrl: string }>>('/owner/upload/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
