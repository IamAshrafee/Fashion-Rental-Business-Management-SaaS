'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { AlertCircle } from 'lucide-react';

export default function AdminDashboardPage() {
  const { data: statsRes, isLoading, error } = useQuery({
    queryKey: ['admin', 'platformStats'],
    queryFn: () => adminApi.getPlatformAnalytics(),
  });

  const stats = statsRes?.data;

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

      {/* Point 14: Error state handling */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Failed to load platform analytics</p>
            <p className="text-xs text-destructive/80">
              {error instanceof Error ? error.message : 'Network error — please retry.'}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-6 shadow-sm">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Points 12/13: Semantic color tokens for dark mode */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Active Tenants</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {stats.tenants?.active || 0}
              </p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                +{stats.tenants?.newThisMonth || 0} this month
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Tenants</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {stats.tenants?.total || 0}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Expected MRR</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {formatCurrency(stats.expectedMrr || stats.mrr || 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">From active subscriptions</p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Actual Revenue (30d)</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {formatCurrency((stats.actualMrr || 0) / 100)}
              </p>
              <p className={`mt-1 text-xs ${
                (stats.actualMrr || 0) / 100 >= (stats.expectedMrr || stats.mrr || 1)
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {stats.expectedMrr || stats.mrr
                  ? `${Math.round(((stats.actualMrr || 0) / 100 / (stats.expectedMrr || stats.mrr)) * 100)}% of expected`
                  : 'From subscription payments'}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">
                {stats.totalOrders || 0}
              </p>
            </div>
          </div>

          {/* Point 18: Real GMV and Churn Rate */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Gross Merchandise Value</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-card-foreground">
                {formatCurrency(stats.gmv || 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Total verified payments across all tenants</p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Churn Rate (30d)</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-card-foreground">
                {stats.churnRate || 0}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Cancelled subscriptions in last 30 days</p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Products</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-card-foreground">
                {stats.totalProducts || 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Products listed across all tenants</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
