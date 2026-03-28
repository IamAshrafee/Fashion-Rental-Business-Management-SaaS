'use client';

/**
 * OwnerGuard — protects owner portal routes.
 *
 * Rules:
 * - Not authenticated → redirect to /login
 * - Role is 'saas_admin' → redirect to /admin (wrong portal)
 * - Role is not 'owner' | 'manager' | 'staff' → redirect to /login
 * - Otherwise: render children
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { LoadingSpinner } from './loading-spinner';

const OWNER_ROLES = ['owner', 'manager', 'staff'] as const;
type OwnerRole = (typeof OWNER_ROLES)[number];

function isOwnerRole(role: string | undefined): role is OwnerRole {
  return OWNER_ROLES.includes(role as OwnerRole);
}

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (user?.role === 'saas_admin') {
      // Admin accidentally landed on owner portal
      router.replace('/admin');
      return;
    }

    if (!isOwnerRole(user?.role)) {
      // Unknown role — boot to login
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Show spinner while session is being restored
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  // Render nothing during the redirect (prevents content flash)
  if (!isAuthenticated || !isOwnerRole(user?.role)) {
    return null;
  }

  return <>{children}</>;
}
