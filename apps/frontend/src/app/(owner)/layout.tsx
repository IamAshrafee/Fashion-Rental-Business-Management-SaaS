import type { Metadata } from 'next';
import { TopBar } from '@/components/owner/layout/top-bar';

export const metadata: Metadata = {
  title: 'Owner Portal',
};

/**
 * Owner portal layout — sidebar + top bar + content area.
 * The sidebar is rendered inside TopBar (desktop: fixed aside, mobile: sheet).
 */
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar is rendered by OwnerSidebar (fixed position) */}
      <div className="lg:pl-64">
        <TopBar />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
