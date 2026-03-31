import type { Metadata } from 'next';
import { TopBar } from '@/components/owner/layout/top-bar';
import { OwnerGuard } from '@/components/shared';
import { ImpersonationBoot } from '@/components/shared/impersonation-boot';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';

export const metadata: Metadata = {
  title: 'Owner Portal',
};

/**
 * Owner portal layout — wraps all /dashboard/* routes with an auth guard.
 *
 * OwnerGuard enforces:
 *   - Must be authenticated (redirects to /login if not)
 *   - Must have owner | manager | staff role (saas_admin → /admin)
 *   - UNLESS impersonation is active/pending
 *
 * ImpersonationBoot (runs BEFORE OwnerGuard):
 *   - Consumes impersonation tokens from localStorage
 *   - Restores impersonation from sessionStorage on page refresh
 *   - Sets in-memory token, cookies, and auth state
 *
 * ImpersonationBanner (runs INSIDE OwnerGuard):
 *   - Shows a sticky banner when admin is impersonating
 */
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Boot: consume impersonation token BEFORE guard checks */}
      <ImpersonationBoot />
      <OwnerGuard>
        <div className="min-h-screen bg-background">
          {/* Banner: show impersonation indicator after auth is settled */}
          <ImpersonationBanner />
          {/* Desktop sidebar is rendered by OwnerSidebar (fixed position) */}
          <div className="lg:pl-64">
            <TopBar />
            <main className="p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </OwnerGuard>
    </>
  );
}

