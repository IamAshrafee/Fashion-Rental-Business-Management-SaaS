'use client';

/**
 * App-level Providers — wraps all pages.
 *
 * Order matters:
 * 1. QueryProvider (TanStack Query)
 * 2. AuthProvider (depends on API client)
 * 3. TenantProvider (depends on API client)
 * 4. Toaster (Sonner notifications)
 */

import type { ReactNode } from 'react';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { TenantProvider } from '@/providers/tenant-provider';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <TenantProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </TenantProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
