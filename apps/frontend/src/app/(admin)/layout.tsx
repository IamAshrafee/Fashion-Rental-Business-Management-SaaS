import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminGuard } from '@/components/shared';

export const metadata: Metadata = {
  title: 'Admin Portal - ClosetRent',
};

/**
 * Super Admin layout — minimal sidebar for internal SaaS management.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-gray-50">
        <aside className="fixed inset-y-0 flex w-64 flex-col border-r bg-white">
        <div className="flex h-14 items-center border-b px-6">
          <span className="font-display text-lg font-bold">
            ClosetRent Admin
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <Link
            href="/admin"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/tenants"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Tenants
          </Link>
          <Link
            href="/admin/plans"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Subscription Plans
          </Link>
        </nav>
      </aside>
        <main className="ml-64 flex-1 p-8">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}

