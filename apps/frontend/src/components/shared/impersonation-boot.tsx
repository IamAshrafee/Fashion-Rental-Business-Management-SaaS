'use client';

import { useEffect, useRef } from 'react';
import { setAccessToken, setTenantIdLocal } from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';

/**
 * ImpersonationBoot — runs OUTSIDE OwnerGuard to intercept the
 * impersonation token BEFORE auth guards evaluate.
 *
 * Flow:
 * 1. Admin panel stores token in localStorage('closetrent_impersonation')
 * 2. This component reads + consumes it on mount (one-time)
 * 3. Sets the in-memory access token + tenant ID
 * 4. Writes session/role cookies so middleware allows subsequent navigations
 * 5. Persists token in sessionStorage so it survives page refreshes
 * 6. Signals the auth provider to refresh user context
 *
 * This component renders nothing — it's purely side-effect logic.
 */
export function ImpersonationBoot() {
  const { refreshUser } = useAuth();
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;

    // ── Path A: Fresh impersonation from admin panel (localStorage) ──
    const raw = localStorage.getItem('closetrent_impersonation');
    if (raw) {
      consumed.current = true;
      try {
        const data = JSON.parse(raw);

        // Validate it's not stale (max 5 minutes old)
        if (Date.now() - data.timestamp > 5 * 60 * 1000) {
          localStorage.removeItem('closetrent_impersonation');
          return;
        }

        // Consume from localStorage (one-time use)
        localStorage.removeItem('closetrent_impersonation');

        applyImpersonation(data.token, data.tenantId, data.expiresIn || 3600);
        refreshUser();
      } catch {
        localStorage.removeItem('closetrent_impersonation');
      }
      return;
    }

    // ── Path B: Restored from sessionStorage (page refresh / Option B) ──
    const storedToken = sessionStorage.getItem('closetrent_impersonation_token');
    const storedTenant = sessionStorage.getItem('closetrent_impersonation_tenant');
    const storedExpires = sessionStorage.getItem('closetrent_impersonation_expires');

    if (storedToken && storedTenant) {
      consumed.current = true;

      // Check if expired
      const expiresAt = Number(storedExpires) || 0;
      if (Date.now() >= expiresAt) {
        clearImpersonationStorage();
        return;
      }

      // Re-apply the token (remaining seconds)
      const remainingSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
      applyImpersonation(storedToken, storedTenant, remainingSeconds);
      refreshUser();
    }
  }, [refreshUser]);

  return null;
}

/**
 * Apply an impersonation token to the auth system.
 * Sets in-memory token, localStorage tenant, cookies, and sessionStorage persistence.
 */
function applyImpersonation(token: string, tenantId: string, expiresInSeconds: number) {
  // 1. Set in-memory access token + tenant
  setAccessToken(token, expiresInSeconds, tenantId);
  setTenantIdLocal(tenantId);

  // 2. Write cookies so middleware allows /dashboard navigation
  document.cookie = `closetrent_session=1; Max-Age=${expiresInSeconds}; path=/; SameSite=Lax`;
  document.cookie = `closetrent_role=owner; Max-Age=${expiresInSeconds}; path=/; SameSite=Lax`;

  // 3. Mark session as impersonation (for OwnerGuard + Banner)
  sessionStorage.setItem('closetrent_is_impersonation', 'true');

  // 4. Persist token in sessionStorage so it survives page refresh (Option B)
  sessionStorage.setItem('closetrent_impersonation_token', token);
  sessionStorage.setItem('closetrent_impersonation_tenant', tenantId);
  sessionStorage.setItem('closetrent_impersonation_expires', String(Date.now() + expiresInSeconds * 1000));
}

/** Clear all impersonation sessionStorage keys */
function clearImpersonationStorage() {
  sessionStorage.removeItem('closetrent_is_impersonation');
  sessionStorage.removeItem('closetrent_impersonation_token');
  sessionStorage.removeItem('closetrent_impersonation_tenant');
  sessionStorage.removeItem('closetrent_impersonation_expires');
}
