import apiClient from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface AuditLogListResponse {
  success: true;
  data: AuditLogEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const auditLogApi = {
  /**
   * GET /owner/audit-logs — paginated, filterable
   */
  getAuditLogs: async (params?: AuditLogQuery) => {
    const { data } = await apiClient.get<AuditLogListResponse>('/owner/audit-logs', { params });
    return data;
  },
};
