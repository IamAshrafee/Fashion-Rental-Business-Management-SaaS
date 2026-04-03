'use client';

import { PageHeader } from '@/components/shared';
import { DashboardStatCards } from './components/stat-cards';
import { DashboardQuickActions } from './components/quick-actions';
import { DashboardRecentBookings } from './components/recent-bookings';
import { DashboardSetupWizard } from './components/setup-wizard';
import { useBookingStats } from '@/hooks/use-booking-stats';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { DashboardRevenueChart } from './components/dashboard-chart';
import { DashboardTopProducts } from './components/top-products';

export default function DashboardPage() {
  const { data: stats, isLoading, isError, error } = useBookingStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Dashboard"
          description="Overview of your fashion rental business"
        />
        <DashboardQuickActions />
      </div>

      <DashboardSetupWizard />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load dashboard data. {(error as Error)?.message || 'Please try again later.'}
          </AlertDescription>
        </Alert>
      ) : stats ? (
        <>
          <DashboardStatCards stats={stats} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Revenue Chart */}
            <DashboardRevenueChart data={stats.revenueChart} className="col-span-1 lg:col-span-4" />
            
            {/* Top Products */}
            <DashboardTopProducts products={stats.topProducts} className="col-span-1 lg:col-span-3" />
          </div>

          <div className="grid gap-4 md:grid-cols-1">
            {/* Recent Bookings Table takes up full width */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium tracking-tight">Recent Activity</h3>
              </div>
              <DashboardRecentBookings bookings={stats.recentBookings} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
