import type { Metadata } from 'next';
import { TopBar } from '@/components/owner/layout/top-bar';
import { OwnerGuard } from '@/components/shared';
import { ImpersonationHandler } from '@/components/shared/impersonation-handler';

export const metadata: Metadata = {
  title: 'Owner Portal',
};

/**
 * Owner portal layout — wraps all /dashboard/* routes with an auth guard.
 *
 * OwnerGuard enforces:
 *   - Must be authenticated (redirects to /login if not)
 *   - Must have owner | manager | staff role (saas_admin → /admin)
 *
 * ImpersonationHandler (Points 4 & 24):
 *   - Consumes impersonation tokens from localStorage
 *   - Shows a sticky banner when admin is impersonating
 */
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OwnerGuard>
      <div className="min-h-screen bg-background">
        {/* Points 4/24: Handle impersonation token exchange + banner */}
        <ImpersonationHandler />
        {/* Desktop sidebar is rendered by OwnerSidebar (fixed position) */}
        <div className="lg:pl-64">
          <TopBar />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </OwnerGuard>
  );
}
