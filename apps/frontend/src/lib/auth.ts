/**
 * Auth Token Management — ClosetRent Frontend
 *
 * Access token lives in MEMORY only (not localStorage).
 * Refresh token is handled via httpOnly cookie (sent by backend).
 *
 * This module manages:
 * 1. In-memory access token storage
 * 2. Token refresh calls
 * 3. Token expiry detection
 */

import apiClient from './api-client';
import type { AuthTokens, AuthUserInfo } from '@/types';

// ----------------------------------------------------------------
// In-Memory Token Store
// ----------------------------------------------------------------

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;
let tenantId: string | null = null;

export function getAccessToken(): string | null {
  if (!accessToken) return null;
  // Check if expired (with 30-second buffer)
  if (Date.now() >= tokenExpiresAt - 30_000) return null;
  return accessToken;
}

export function getTenantId(): string | null {
  if (tenantId) return tenantId;
  if (typeof window !== 'undefined') {
    tenantId = localStorage.getItem('closetrent_tenant_id');
    return tenantId;
  }
  return null;
}

export function setAccessToken(token: string, expiresIn: number, tid: string | null = null): void {
  accessToken = token;
  // expiresIn is in seconds, convert to ms
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  if (tid) {
    tenantId = tid;
    if (typeof window !== 'undefined') {
      localStorage.setItem('closetrent_tenant_id', tid);
    }
  }
}

export function clearAccessToken(): void {
  accessToken = null;
  tokenExpiresAt = 0;
  tenantId = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('closetrent_tenant_id');
  }
}

// ----------------------------------------------------------------
// Token Refresh
// ----------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh the access token using the httpOnly refresh cookie.
 * De-duplicates concurrent refresh calls.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in-flight, wait for that one
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: AuthTokens;
      }>('/auth/refresh', {}, { withCredentials: true });

      if (response.data.success) {
        const { accessToken: newToken, expiresIn, user } = response.data.data as AuthTokens & { user?: { tenantId?: string } };
        // We might not get the user obj on refresh depending on backend, but if we do, use its tenantId
        setAccessToken(newToken, expiresIn);
        return newToken;
      }
      return null;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ----------------------------------------------------------------
// Login / Logout Helpers
// ----------------------------------------------------------------

export async function loginWithCredentials(
  emailOrPhone: string,
  password: string,
  tenantSlug?: string,
): Promise<AuthUserInfo> {
  const response = await apiClient.post<{
    success: boolean;
    data: {
      user: AuthUserInfo;
      tenants: Array<{ id: string; subdomain: string; businessName: string; role: string }>;
      accessToken: string;
      expiresIn: number;
    };
  }>(
    '/auth/login',
    { identifier: emailOrPhone, password, tenantSlug },
    { withCredentials: true },
  );

  const { user, tenants, accessToken: token, expiresIn } = response.data.data;
  const primaryTenantId = tenants?.[0]?.id || null;
  
  setAccessToken(token, expiresIn, primaryTenantId);
  
  // Attach the tenantId to the user object we return so the auth provider has it
  return { ...user, tenantId: primaryTenantId };
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout', {}, { withCredentials: true });
  } finally {
    clearAccessToken();
  }
}
