import type { Metadata } from 'next';
import { TopBar } from '@/components/owner/layout/top-bar';
import { OwnerGuard } from '@/components/shared';

export const metadata: Metadata = {
  title: 'Owner Portal',
};

/**
 * Owner portal layout — wraps all /dashboard/* routes with an auth guard.
 *
 * OwnerGuard enforces:
 *   - Must be authenticated (redirects to /login if not)
 *   - Must have owner | manager | staff role (saas_admin → /admin)
 */
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OwnerGuard>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar is rendered by OwnerSidebar (fixed position) */}
        <div className="lg:pl-64">
          <TopBar />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </OwnerGuard>
  );
}
