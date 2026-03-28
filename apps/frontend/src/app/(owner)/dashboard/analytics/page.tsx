'use client';

import { useState } from 'react';
import { SummaryCards } from './components/summary-cards';
import { RevenueChart } from './components/revenue-chart';
import { CategoryDistribution } from './components/category-distribution';
import { TopProducts } from './components/top-products';
import { TargetRecovery } from './components/target-recovery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

type TimeRange = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth';

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('30d');

  const getDateRange = (r: TimeRange) => {
    const today = new Date();
    
    switch (r) {
      case 'today':
        return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case '7d':
        return { from: format(subDays(today, 7), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case '30d':
      default:
        return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'thisMonth':
        return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), to: format(endOfMonth(lastMonth), 'yyyy-MM-dd') };
    }
  };

  const currentRange = getDateRange(range);

  return (
    <div className="flex flex-col flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 w-full text-left">
          <h2 className="text-3xl font-bold tracking-tight">Analytics Overview</h2>
          <p className="text-muted-foreground">Monitor your store performance and target recoveries.</p>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="thisMonth">This month</SelectItem>
              <SelectItem value="lastMonth">Last month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        <SummaryCards dateRange={currentRange} />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <RevenueChart dateRange={currentRange} />
          <CategoryDistribution />
        </div>

        <TargetRecovery />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 pt-2">
          <div className="col-span-1 lg:col-span-2">
            <TopProducts sortBy="bookings" />
          </div>
          <TopProducts sortBy="revenue" />
        </div>
      </div>
    </div>
  );
}
