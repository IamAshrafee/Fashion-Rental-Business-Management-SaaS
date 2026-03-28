'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';

export default function AdminDashboardPage() {
  const { data: statsRes, isLoading } = useQuery({
    queryKey: ['admin', 'platformStats'],
    queryFn: () => adminApi.getPlatformAnalytics(),
  });

  const stats = statsRes?.data;

  // Formatting utility
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Global SaaS management and platform analytics"
      />

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading metrics...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Active Tenants</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {stats?.tenants?.active || 0}
            </p>
            <p className="mt-1 text-xs text-green-600">
              +{stats?.tenants?.newThisMonth || 0} this month
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Tenants</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {stats?.tenants?.total || 0}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total MRR</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {formatCurrency(stats?.mrr || 0)}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {stats?.totalOrders || 0}
            </p>
          </div>
        </div>
      )}

      {/* Placeholder for future growth / churn charts */}
      {!isLoading && (
        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Overview</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded border border-dashed">
            <p className="text-sm text-gray-500">Growth charts will appear here (requires more data)</p>
          </div>
        </div>
      )}
    </div>
  );
}
