import {
  AdminTenantDetails,
  AdminTenantSummary,
  ApiResponse,
  PaginatedResponse,
  PlatformStats,
  SubscriptionPlan,
  SubscriptionPayment,
  PlatformInvoice,
  PromoCode,
  SubscriptionHistoryEntry,
  TenantStatus,
  BillingCycle,
} from '@closetrent/types';
import apiClient from './api-client';

/**
 * Admin API calls use a wrapper that strips
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
    paymentStatus?: string;
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

  async deleteTenant(id: string): Promise<ApiResponse<any>> {
    const res = await admin.delete(`/admin/tenants/${id}`);
    return res.data;
  },

  // --- Analytics ---
  async getPlatformAnalytics(): Promise<ApiResponse<PlatformStats>> {
    const res = await admin.get('/admin/analytics/platform');
    return res.data;
  },

  // --- Resource Monitor ---
  async getResourceMonitorOverview(): Promise<ApiResponse<any>> {
    const res = await admin.get('/admin/resource-monitor');
    return res.data;
  },

  async getResourceAlerts(): Promise<ApiResponse<any>> {
    const res = await admin.get('/admin/resource-monitor/alerts');
    return res.data;
  },

  async getTenantResourceHistory(
    id: string,
    params?: { from?: string; to?: string; limit?: number }
  ): Promise<ApiResponse<any>> {
    const res = await admin.get(`/admin/tenants/${id}/resource-history`, { params });
    return res.data;
  },

  async getTenantLiveMetrics(id: string): Promise<ApiResponse<any>> {
    const res = await admin.get(`/admin/tenants/${id}/live-metrics`);
    return res.data;
  },

  // --- Activity Log ---
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

  // --- Subscription Payments ---
  async recordPayment(
    tenantId: string,
    data: {
      amount: number;
      method: string;
      reference?: string;
      notes?: string;
      extendMonths?: number;
    }
  ): Promise<ApiResponse<SubscriptionPayment>> {
    const res = await admin.post(`/admin/tenants/${tenantId}/payments`, data);
    return res.data;
  },

  async getPaymentHistory(
    tenantId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<SubscriptionPayment>> {
    const res = await admin.get(`/admin/tenants/${tenantId}/payments`, { params });
    return res.data;
  },

  // --- Invoices ---
  async generateInvoice(
    tenantId: string,
    data: {
      amount: number;
      dueDate: string;
      lineItems: { description: string; quantity: number; rate: number; amount: number }[];
      notes?: string;
    }
  ): Promise<ApiResponse<PlatformInvoice>> {
    const res = await admin.post(`/admin/tenants/${tenantId}/invoices`, data);
    return res.data;
  },

  async getInvoices(
    tenantId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<PlatformInvoice>> {
    const res = await admin.get(`/admin/tenants/${tenantId}/invoices`, { params });
    return res.data;
  },

  async updateInvoiceStatus(
    invoiceId: string,
    data: { status: string; paymentId?: string }
  ): Promise<ApiResponse<PlatformInvoice>> {
    const res = await admin.patch(`/admin/invoices/${invoiceId}`, data);
    return res.data;
  },

  // --- Subscription Extension ---
  async extendSubscription(
    tenantId: string,
    data: { months?: number; reason?: string }
  ): Promise<ApiResponse<{ newPeriodEnd: string; months: number }>> {
    const res = await admin.patch(`/admin/tenants/${tenantId}/subscription/extend`, data);
    return res.data;
  },

  // --- Subscription History ---
  async getSubscriptionHistory(
    tenantId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<SubscriptionHistoryEntry>> {
    const res = await admin.get(`/admin/tenants/${tenantId}/subscription/history`, { params });
    return res.data;
  },

  // --- Promo Codes ---
  async getPromoCodes(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PromoCode>> {
    const res = await admin.get('/admin/promo-codes', { params });
    return res.data;
  },

  async createPromoCode(data: {
    code: string;
    linkedPlanId?: string;
    trialDays?: number;
    discountPct?: number;
    maxUses?: number;
    expiresAt?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<PromoCode>> {
    const res = await admin.post('/admin/promo-codes', data);
    return res.data;
  },

  async updatePromoCode(
    id: string,
    data: Partial<PromoCode>
  ): Promise<ApiResponse<PromoCode>> {
    const res = await admin.patch(`/admin/promo-codes/${id}`, data);
    return res.data;
  },

  // --- Bulk Operations ---
  async bulkExtendSubscriptions(
    tenantIds: string[],
    months: number
  ): Promise<ApiResponse<{ processed: number }>> {
    const results = await Promise.all(
      tenantIds.map((id) =>
        admin.patch(`/admin/tenants/${id}/subscription/extend`, { months }).catch(() => null)
      )
    );
    return { success: true, data: { processed: results.filter(Boolean).length } };
  },

  async bulkChangePlan(
    tenantIds: string[],
    planId: string,
    billingCycle: BillingCycle
  ): Promise<ApiResponse<{ processed: number }>> {
    const results = await Promise.all(
      tenantIds.map((id) =>
        admin.patch(`/admin/tenants/${id}/plan`, { planId, billingCycle }).catch(() => null)
      )
    );
    return { success: true, data: { processed: results.filter(Boolean).length } };
  },
};

