import {
  AdminTenantDetails,
  AdminTenantSummary,
  ApiResponse,
  PaginatedResponse,
  PlatformStats,
  SubscriptionPlan,
  TenantStatus,
  BillingCycle,
} from '@closetrent/types';
import apiClient from './api-client';

export const adminApi = {
  // --- Tenants ---
  async getTenants(params?: {
    status?: string;
    plan?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }): Promise<PaginatedResponse<AdminTenantSummary>> {
    const res = await apiClient.get('/admin/tenants', { params });
    return res.data;
  },

  async getTenant(id: string): Promise<ApiResponse<AdminTenantDetails>> {
    const res = await apiClient.get(`/admin/tenants/${id}`);
    return res.data;
  },

  async updateTenantStatus(
    id: string,
    status: TenantStatus,
    reason?: string
  ): Promise<ApiResponse<AdminTenantDetails>> {
    const res = await apiClient.patch(`/admin/tenants/${id}/status`, {
      status,
      reason,
    });
    return res.data;
  },

  async updateTenantPlan(
    id: string,
    planId: string,
    billingCycle: BillingCycle
  ): Promise<ApiResponse<any>> {
    const res = await apiClient.patch(`/admin/tenants/${id}/plan`, {
      planId,
      billingCycle,
    });
    return res.data;
  },

  async impersonateTenant(id: string): Promise<
    ApiResponse<{
      impersonationToken: string;
      tenantId: string;
      businessName: string;
      expiresIn: number;
    }>
  > {
    const res = await apiClient.post(`/admin/tenants/${id}/impersonate`);
    return res.data;
  },

  // --- Analytics ---
  async getPlatformAnalytics(): Promise<ApiResponse<PlatformStats>> {
    const res = await apiClient.get('/admin/analytics/platform');
    return res.data;
  },

  // --- Plans ---
  async getPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    const res = await apiClient.get('/admin/plans');
    return res.data;
  },

  async createPlan(data: Partial<SubscriptionPlan>): Promise<ApiResponse<SubscriptionPlan>> {
    const res = await apiClient.post('/admin/plans', data);
    return res.data;
  },

  async updatePlan(id: string, data: Partial<SubscriptionPlan>): Promise<ApiResponse<SubscriptionPlan>> {
    const res = await apiClient.patch(`/admin/plans/${id}`, data);
    return res.data;
  },
};
