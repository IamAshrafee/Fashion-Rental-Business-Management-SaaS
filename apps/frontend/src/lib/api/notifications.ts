import apiClient from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  tenantId: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  success: true;
  data: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface UnreadCountResponse {
  success: true;
  data: { unreadCount: number };
}

export interface MarkReadResponse {
  success: true;
  data: { id: string; isRead: boolean; readAt: string };
}

export interface MarkAllReadResponse {
  success: true;
  data: { markedCount: number };
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const notificationApi = {
  /**
   * GET /owner/notifications — paginated, unread first
   */
  getNotifications: async (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
    const { data } = await apiClient.get<NotificationListResponse>('/owner/notifications', { params });
    return data;
  },

  /**
   * GET /owner/notifications/unread-count — badge count
   */
  getUnreadCount: async () => {
    const { data } = await apiClient.get<UnreadCountResponse>('/owner/notifications/unread-count');
    return data;
  },

  /**
   * PATCH /owner/notifications/read-all — mark all read
   */
  markAllRead: async () => {
    const { data } = await apiClient.patch<MarkAllReadResponse>('/owner/notifications/read-all');
    return data;
  },

  /**
   * PATCH /owner/notifications/:id/read — mark single read
   */
  markRead: async (id: string) => {
    const { data } = await apiClient.patch<MarkReadResponse>(`/owner/notifications/${id}/read`);
    return data;
  },

  /**
   * DELETE /owner/notifications/:id — dismiss
   */
  dismiss: async (id: string) => {
    const { data } = await apiClient.delete(`/owner/notifications/${id}`);
    return data;
  },
};
