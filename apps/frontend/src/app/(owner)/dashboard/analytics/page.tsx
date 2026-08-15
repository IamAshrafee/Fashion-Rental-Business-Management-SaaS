'use client';

import { useState } from 'react';
import { SummaryCards } from './components/summary-cards';
import { RevenueChart } from './components/revenue-chart';
import { CategoryDistribution } from './components/category-distribution';
import { TopProducts } from './components/top-products';
import { CostRecovery } from './components/cost-recovery';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { subDays, startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyticsApi } from '@/lib/api/analytics';
import { toast } from 'sonner';

type TimeRange = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth';

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('30d');
  const [exporting, setExporting] = useState<string | null>(null);

  const getDateRange = (r: TimeRange) => {
    const today = new Date();

    switch (r) {
      case 'today':
        return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case '7d':
        return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case '30d':
      default:
        return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'thisMonth':
        return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'lastMonth': {
        const lastMonth = subMonths(today, 1);
        return {
          from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          to: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        };
      }
    }
  };

  const currentRange = getDateRange(range);

  const download = async (type: 'bookings' | 'customers' | 'inventory' | 'payments') => {
    setExporting(type);
    try {
      const result = await analyticsApi.downloadExport(type, currentRange);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 w-full text-left">
          <h2 className="text-3xl font-bold tracking-tight">Analytics Overview</h2>
          <p className="text-muted-foreground">
            Monitor store performance and physical-item cost recovery.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 self-end md:self-auto">
          {(['bookings', 'customers', 'inventory', 'payments'] as const).map((type) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              disabled={Boolean(exporting)}
              onClick={() => download(type)}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting === type ? 'Preparing…' : type[0].toUpperCase() + type.slice(1)}
            </Button>
          ))}
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
          <CategoryDistribution dateRange={currentRange} />
        </div>

        <CostRecovery />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 pt-2">
          <div className="col-span-1 lg:col-span-2">
            <TopProducts sortBy="bookings" dateRange={currentRange} />
          </div>
          <TopProducts sortBy="revenue" dateRange={currentRange} />
        </div>
      </div>
    </div>
  );
}
