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
    setTenantIdLocal(tid);
  }
}

export function setTenantIdLocal(tid: string | null): void {
  tenantId = tid;
  if (typeof window !== 'undefined') {
    if (tid) {
      localStorage.setItem('closetrent_tenant_id', tid);
    } else {
      localStorage.removeItem('closetrent_tenant_id');
    }
  }
}

export function clearAccessToken(): void {
  accessToken = null;
  tokenExpiresAt = 0;
  tenantId = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('closetrent_tenant_id');
    // Clear middleware marker cookies
    document.cookie = 'closetrent_session=; Max-Age=0; path=/';
    document.cookie = 'closetrent_role=; Max-Age=0; path=/';
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
        const { accessToken: newToken, expiresIn = 900 } = response.data.data as AuthTokens & { user?: { tenantId?: string } };
        setAccessToken(newToken, expiresIn);
        // Extend marker cookie so middleware stays in sync (7 days)
        if (typeof document !== 'undefined') {
          const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
          document.cookie = `closetrent_session=1; Max-Age=${REFRESH_MAX_AGE}; path=/; SameSite=Lax`;
        }
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
      suspendedTenants?: Array<{ id: string; businessName: string; subdomain: string; status: string; statusReason: string | null }>;
      accessToken: string;
      expiresIn: number;
    };
  }>(
    '/auth/login',
    { identifier: emailOrPhone, password, tenantSlug },
    { withCredentials: true },
  );

  const {
    user,
    tenants,
    suspendedTenants = [],
    accessToken: token,
    expiresIn = 900,
  } = response.data.data;
  const primaryTenantId = tenants?.[0]?.id || null;
  const primarySubdomain = tenants?.[0]?.subdomain || null;

  setAccessToken(token, expiresIn, primaryTenantId);

  // Write non-httpOnly marker cookies so middleware can do server-side routing
  // NOTE: These match the refresh token lifespan (7 days), NOT the short-lived access token.
  if (typeof document !== 'undefined') {
    const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
    
    // Allow cookies to span subdomains
    const domainStr = window.location.hostname.includes('localhost') 
      ? '; domain=localhost' 
      : `; domain=.${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com'}`;
      
    document.cookie = `closetrent_session=1; Max-Age=${REFRESH_MAX_AGE}; path=/; SameSite=Lax${domainStr}`;
    document.cookie = `closetrent_role=${user.role}; Max-Age=${REFRESH_MAX_AGE}; path=/; SameSite=Lax${domainStr}`;
  }

  // Attach the tenantId, subdomain, and suspendedTenants to the user object we return
  return { ...user, tenantId: primaryTenantId, subdomain: primarySubdomain, suspendedTenants };
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout', {}, { withCredentials: true });
  } finally {
    clearAccessToken();
  }
}
