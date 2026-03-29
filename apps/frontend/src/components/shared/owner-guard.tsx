'use client';

/**
 * OwnerGuard — protects owner portal routes.
 *
 * Rules:
 * - Session cookie missing + not authenticated → redirect to /login?from={currentPath}
 * - Role is 'saas_admin' → redirect to /admin (wrong portal)
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

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [cookieExists] = useState(() => hasSessionCookie());

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // If the session cookie still exists, the refresh likely had a transient
      // failure. Don't redirect — the interceptor will retry on next API call.
      // Only redirect to login if the cookie is genuinely gone.
      if (cookieExists) return;

      const from = pathname && pathname !== '/dashboard' ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${from}`);
      return;
    }

    if (user?.role === 'saas_admin') {
      router.replace('/admin');
      return;
    }

    if (!isOwnerRole(user?.role)) {
      const from = pathname ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${from}`);
    }
  }, [isLoading, isAuthenticated, user, router, pathname, cookieExists]);

  // Show spinner while session is being restored OR cookie exists but auth not ready yet
  if (isLoading || (!isAuthenticated && cookieExists)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  // Not authenticated and no cookie — render nothing while redirecting to login
  if (!isAuthenticated || !isOwnerRole(user?.role)) {
    return null;
  }

  return <>{children}</>;
}
