/**
 * Owner Dashboard — placeholder page.
 * Full implementation in P12.
 */

import { PageHeader } from '@/components/shared';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your fashion rental business"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {['Total Bookings', 'Revenue', 'Active Rentals', 'Products'].map(
          (label) => (
            <div
              key={label}
              className="rounded-lg border bg-card p-6 shadow-sm"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">—</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
