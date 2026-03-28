/**
 * Centralized Axios Instance — ClosetRent Frontend
 *
 * Features:
 * - Base URL from environment
 * - Request interceptor: attach JWT from memory + tenant header
 * - Response interceptor: auto-refresh on 401, global error toast
 */

import axios from 'axios';
import { getAccessToken, refreshAccessToken, clearAccessToken, getTenantId } from './auth';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: true, // Send httpOnly cookies for refresh
});

// ----------------------------------------------------------------
// Request Interceptor — attach JWT + tenant header
// ----------------------------------------------------------------

apiClient.interceptors.request.use(
  (config) => {
    // Attach in-memory JWT if available
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const tid = getTenantId();
    if (tid) {
      config.headers['x-tenant-id'] = tid;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ----------------------------------------------------------------
// Response Interceptor — auto-refresh on 401
// ----------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried, try to refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Don't try to refresh on auth endpoints themselves
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      // Refresh failed — clear state, redirect to login
      clearAccessToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
