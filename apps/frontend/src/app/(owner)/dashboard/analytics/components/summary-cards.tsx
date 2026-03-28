'use client';

import { useAnalyticsSummary } from '../hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeDollarSign, ShoppingBag, Users, TrendingUp } from 'lucide-react';

export function SummaryCards({ dateRange }: { dateRange: { from?: string; to?: string } }) {
  const { data: response, isLoading } = useAnalyticsSummary(dateRange);
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-transparent bg-muted rounded">Loading Title</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-muted rounded w-1/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const data = response?.data;
  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.revenue.total)}</div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className={data.revenue.growthPercentage >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {data.revenue.growthPercentage >= 0 ? '+' : ''}{data.revenue.growthPercentage}%
            </span>
            <span>from previous period</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Orders</CardTitle>
          <ShoppingBag className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.bookings.total}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.bookings.completed} completed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
          <TrendingUp className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.revenue.averageOrderValue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Per completed booking
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Customers</CardTitle>
          <Users className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.customers.total}</div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-emerald-600">+{data.customers.new} new</span> this period
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
