/**
 * SaaS Admin Portal — placeholder.
 * Full implementation in P19.
 */

import { PageHeader } from '@/components/shared';

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Admin Portal"
        description="Global SaaS management and tenant oversight"
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {['Total Tenants', 'Active Tenants', 'MRR'].map((label) => (
          <div key={label} className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              —
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
