'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { TrafficKpiCards } from './components/traffic-kpi-cards';
import { FunnelChart } from './components/funnel-chart';
import { TopViewedProducts } from './components/top-viewed-products';
import { MarketingAttribution } from './components/marketing-attribution';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';
import { Loader2 } from 'lucide-react';

type TimeRange = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth';

export default function TrafficDashboardPage() {
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

  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['traffic-summary', currentRange],
    queryFn: () => analyticsApi.getStorefrontSummary(currentRange),
  });

  const { data: funnelData, isLoading: isLoadingFunnel } = useQuery({
    queryKey: ['traffic-funnel', currentRange],
    queryFn: () => analyticsApi.getFunnelMetrics(currentRange),
  });

  const { data: topProductsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['traffic-top-products', currentRange],
    queryFn: () => analyticsApi.getTopViewedProducts(currentRange),
  });

  const { data: attributionData, isLoading: isLoadingAttr } = useQuery({
    queryKey: ['traffic-attribution', currentRange],
    queryFn: () => analyticsApi.getMarketingAttribution(currentRange),
  });

  const isLoading = isLoadingSummary || isLoadingFunnel || isLoadingProducts || isLoadingAttr;

  return (
    <div className="flex flex-col flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 w-full text-left">
          <h2 className="text-3xl font-bold tracking-tight">Traffic & Funnel</h2>
          <p className="text-muted-foreground">Monitor storefront visitors, drop-off rates, and marketing attribution.</p>
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

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <TrafficKpiCards summary={summaryData?.data} />

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <FunnelChart data={funnelData?.data} />
            <MarketingAttribution data={attributionData?.data} />
          </div>

          <TopViewedProducts data={topProductsData?.data} />
        </div>
      )}
    </div>
  );
}
