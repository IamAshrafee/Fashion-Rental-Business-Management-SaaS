import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Portal',
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
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 flex w-64 flex-col border-r bg-white">
        <div className="flex h-14 items-center border-b px-6">
          <span className="font-display text-lg font-bold">
            ClosetRent Admin
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <a
            href="/admin"
            className="flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900"
          >
            Tenants
          </a>
          <a
            href="/admin/billing"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Billing
          </a>
          <a
            href="/admin/settings"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Global Settings
          </a>
        </nav>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}
