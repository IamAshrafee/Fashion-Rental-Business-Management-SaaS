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

/**
 * Point 23: Admin API calls use a wrapper that strips
 * x-tenant-id header to prevent accidental tenant resolution.
 */
function adminRequest() {
  return {
    get: <T = any>(url: string, config?: any) =>
      apiClient.get<T>(url, {
        ...config,
        headers: { ...config?.headers, 'x-tenant-id': undefined },
      }),
    post: <T = any>(url: string, data?: any, config?: any) =>
      apiClient.post<T>(url, data, {
        ...config,
        headers: { ...config?.headers, 'x-tenant-id': undefined },
      }),
    patch: <T = any>(url: string, data?: any, config?: any) =>
      apiClient.patch<T>(url, data, {
        ...config,
        headers: { ...config?.headers, 'x-tenant-id': undefined },
      }),
    delete: <T = any>(url: string, config?: any) =>
      apiClient.delete<T>(url, {
        ...config,
        headers: { ...config?.headers, 'x-tenant-id': undefined },
      }),
  };
}

const admin = adminRequest();

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
    const res = await admin.get('/admin/tenants', { params });
    return res.data;
  },

  async getTenant(id: string): Promise<ApiResponse<AdminTenantDetails>> {
    const res = await admin.get(`/admin/tenants/${id}`);
    return res.data;
  },

  async updateTenantStatus(
    id: string,
    status: TenantStatus,
    reason?: string
  ): Promise<ApiResponse<AdminTenantDetails>> {
    const res = await admin.patch(`/admin/tenants/${id}/status`, {
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
    const res = await admin.patch(`/admin/tenants/${id}/plan`, {
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
      subdomain: string;
      expiresIn: number;
    }>
  > {
    const res = await admin.post(`/admin/tenants/${id}/impersonate`);
    return res.data;
  },

  /** Point 19: Soft-delete tenant */
  async deleteTenant(id: string): Promise<ApiResponse<any>> {
    const res = await admin.delete(`/admin/tenants/${id}`);
    return res.data;
  },

  // --- Analytics ---
  async getPlatformAnalytics(): Promise<ApiResponse<PlatformStats>> {
    const res = await admin.get('/admin/analytics/platform');
    return res.data;
  },

  // --- Activity Log (Point 20) ---
  async getActivityLog(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    const res = await admin.get('/admin/activity-log', { params });
    return res.data;
  },

  // --- Plans ---
  async getPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    const res = await admin.get('/admin/plans');
    return res.data;
  },

  async createPlan(data: Partial<SubscriptionPlan>): Promise<ApiResponse<SubscriptionPlan>> {
    const res = await admin.post('/admin/plans', data);
    return res.data;
  },

  async updatePlan(id: string, data: Partial<SubscriptionPlan>): Promise<ApiResponse<SubscriptionPlan>> {
    const res = await admin.patch(`/admin/plans/${id}`, data);
    return res.data;
  },
};
