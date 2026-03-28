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

export function getAccessToken(): string | null {
  if (!accessToken) return null;
  // Check if expired (with 30-second buffer)
  if (Date.now() >= tokenExpiresAt - 30_000) return null;
  return accessToken;
}

export function setAccessToken(token: string, expiresIn: number): void {
  accessToken = token;
  // expiresIn is in seconds, convert to ms
  tokenExpiresAt = Date.now() + expiresIn * 1000;
}

export function clearAccessToken(): void {
  accessToken = null;
  tokenExpiresAt = 0;
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
        const { accessToken: newToken, expiresIn } = response.data.data;
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
      accessToken: string;
      expiresIn: number;
    };
  }>(
    '/auth/login',
    { emailOrPhone, password, tenantSlug },
    { withCredentials: true },
  );

  const { user, accessToken: token, expiresIn } = response.data.data;
  setAccessToken(token, expiresIn);
  return user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout', {}, { withCredentials: true });
  } finally {
    clearAccessToken();
  }
}
