'use client';

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { ClipboardList, Filter, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import type { DashboardStats } from '@/hooks/use-booking-stats';
import Link from 'next/link';

export function DashboardStatCards({ stats }: { stats: DashboardStats }) {
  // Safe parsing/formatting
  const formattedRevenue = new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(stats.revenueThisMonth || 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Pending / New Bookings */}
      <Link href="/dashboard/bookings?status=pending">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Bookings</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires confirmation
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Revenue */}
      <Link href="/dashboard/analytics">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedRevenue}</div>
            <p className="text-xs text-emerald-500 font-medium mt-1">
              +15% from last month
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Active Rentals */}
      <Link href="/dashboard/bookings?status=delivered">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rentals</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently rented out
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Overdue */}
      <Link href="/dashboard/bookings?status=overdue">
        <Card className="hover:border-destructive/50 hover:bg-destructive/5 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Returns</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 text-destructive/80">
              Needs immediate action
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
