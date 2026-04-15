import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminGuard } from '@/components/shared';
import { AdminLogoutButton } from './components/admin-logout-button';

export const metadata: Metadata = {
  title: 'Admin Portal - ClosetRent',
};

/**
 * Super Admin layout — minimal sidebar for internal SaaS management.
 * Points 12/13: Dark mode support with semantic color tokens.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-muted/40 dark:bg-background">
        <aside className="fixed inset-y-0 flex w-64 flex-col border-r bg-card dark:bg-card">
        <div className="flex h-14 items-center border-b px-6">
          <span className="font-display text-lg font-bold text-card-foreground">
            ClosetRent Admin
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <Link
            href="/admin"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/tenants"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          >
            Tenants
          </Link>
          <Link
            href="/admin/resources"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          >
            Resource Monitor
          </Link>
          <Link
            href="/admin/plans"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          >
            Subscription Plans
          </Link>
          <Link
            href="/admin/activity"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          >
            Activity Log
          </Link>
          <Link
            href="/admin/promo-codes"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          >
            Promo Codes
          </Link>
        </nav>
        <div className="p-4 border-t border-border">
          <AdminLogoutButton />
        </div>
      </aside>
        <main className="ml-64 flex-1 p-8">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
