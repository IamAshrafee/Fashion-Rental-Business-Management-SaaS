/**
 * Centralized Axios Instance — ClosetRent Frontend
 *
 * Features:
 * - Dynamic base URL: uses the current subdomain/custom-domain so the
 *   backend TenantMiddleware can resolve the tenant from the Host header
 * - Request interceptor: attach JWT from memory + tenant header
 * - Response interceptor: auto-refresh on 401, global error toast
 */

import axios from 'axios';
import { getAccessToken, refreshAccessToken, clearAccessToken, getTenantId } from './auth';

// ----------------------------------------------------------------
// Dynamic Base URL
// ----------------------------------------------------------------

/**
 * Build the API base URL based on the current hostname.
 *
 * In development with subdomains:
 *   rentiva.localhost:3000 → http://rentiva.localhost:4000/api/v1
 *   rentbysara.local:3000  → http://rentbysara.local:4000/api/v1
 *   localhost:3000          → http://localhost:4000/api/v1
 *
 * In production (via Nginx):
 *   rentiva.closetrent.com → /api/v1 (same origin, proxied by Nginx)
 */
function getApiBaseUrl(): string {
  // Server-side rendering — use env var
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  }

  const hostname = window.location.hostname;

  // Development: *.localhost → backend on same subdomain, port 4000
  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    return `http://${hostname}:4000/api/v1`;
  }

  // Development: custom domain via hosts file (*.local)
  if (hostname.endsWith('.local')) {
    return `http://${hostname}:4000/api/v1`;
  }

  // Production: API on same host via Nginx proxy
  return process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${hostname}/api/v1`;
}

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: true, // Send httpOnly cookies for refresh
});

// Recalculate base URL on every request (handles SPA navigation between tenants)
apiClient.interceptors.request.use(
  (config) => {
    // Update baseURL dynamically in case the user navigates between subdomains
    if (typeof window !== 'undefined') {
      config.baseURL = getApiBaseUrl();
    }

    // Attach in-memory JWT if available
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach tenant ID from auth state (for authenticated requests)
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
    // ── Detect tenant suspension (403 from TenantMiddleware) ──────
    // Scenario A: owner is mid-session when admin suspends their store.
    // Instead of showing broken UI, redirect to a clear explanation page.
    if (error.response?.status === 403) {
      const message: string = error.response?.data?.message || error.response?.data?.error?.message || '';
      if (
        message.includes('suspended') ||
        message.includes('no longer active')
      ) {
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/store-suspended')
        ) {
          window.location.href = '/store-suspended';
        }
        return Promise.reject(error);
      }
    }

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
