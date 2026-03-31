'use client';

/**
 * OwnerGuard — protects owner portal routes.
 *
 * Rules:
 * - Session cookie missing + not authenticated → redirect to /login?from={currentPath}
 * - Role is 'saas_admin' → redirect to /admin (wrong portal)
 *   UNLESS impersonation is active (sessionStorage marker or pending localStorage token)
 * - Role is not 'owner' | 'manager' | 'staff' → redirect to /login
 * - Session cookie exists but auth restoring → keep showing spinner (no redirect)
 * - Otherwise: render children
 */

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { LoadingSpinner } from './loading-spinner';

const OWNER_ROLES = ['owner', 'manager', 'staff'] as const;
type OwnerRole = (typeof OWNER_ROLES)[number];

function isOwnerRole(role: string | undefined): role is OwnerRole {
  return OWNER_ROLES.includes(role as OwnerRole);
}

/** Check if the session marker cookie exists (set by backend on login) */
function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('closetrent_session='));
}

/**
 * Check if an impersonation session is active or pending.
 * Covers both:
 * - Active impersonation (sessionStorage marker set by ImpersonationBoot)
 * - Pending impersonation (localStorage token not yet consumed by ImpersonationBoot)
 */
function checkImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    sessionStorage.getItem('closetrent_is_impersonation') === 'true' ||
    !!localStorage.getItem('closetrent_impersonation')
  );
}

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, tenantId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [cookieExists] = useState(() => hasSessionCookie());
  const [impersonating] = useState(() => checkImpersonating());

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // If the session cookie still exists, the refresh likely had a transient
      // failure. Don't redirect — the interceptor will retry on next API call.
      if (cookieExists) return;

      // If there's a pending impersonation, don't redirect —
      // ImpersonationBoot will consume the token and set cookies
      if (impersonating) return;

      const from = pathname && pathname !== '/dashboard' ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${from}`);
      return;
    }

    if (user?.role === 'saas_admin') {
      // Don't redirect during impersonation — ImpersonationBoot has swapped the token
      if (impersonating) return;
      router.replace('/admin');
      return;
    }

    if (!isOwnerRole(user?.role)) {
      const from = pathname ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${from}`);
      return;
    }

    // Safety net: owner with no tenant context → likely suspended
    // Catches edge cases like direct URL navigation or stale sessions
    if (isOwnerRole(user?.role) && !tenantId && !impersonating) {
      router.replace('/store-suspended');
    }
  }, [isLoading, isAuthenticated, user, router, pathname, cookieExists, impersonating, tenantId]);

  // Show spinner while session is being restored, cookie exists but auth not ready,
  // or impersonation is pending
  if (isLoading || (!isAuthenticated && (cookieExists || impersonating))) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  // Not authenticated and no cookie/impersonation — render nothing while redirecting
  if (!isAuthenticated || (!isOwnerRole(user?.role) && !impersonating)) {
    return null;
  }

  return <>{children}</>;
}

