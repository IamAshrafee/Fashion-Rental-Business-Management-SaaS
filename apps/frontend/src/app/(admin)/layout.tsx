import type { Metadata } from 'next';
import { AdminGuard } from '@/components/shared';
import { AdminNavigation } from './components/admin-navigation';

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
      <div className="min-h-screen bg-muted/40 dark:bg-background">
        <AdminNavigation />
        <main className="p-4 sm:p-6 lg:ml-64 lg:p-8">{children}</main>
      </div>
    </AdminGuard>
  );
}
