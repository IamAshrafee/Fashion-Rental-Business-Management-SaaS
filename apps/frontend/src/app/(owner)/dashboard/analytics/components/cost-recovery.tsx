'use client';

import { useCostRecovery } from '../hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyticsApi } from '@/lib/api/analytics';
import { toast } from 'sonner';
import { FieldTip } from '@/components/shared/field-tip';

export function CostRecovery() {
  const { data: response, isLoading } = useCostRecovery();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(amount);

  const handleExport = async () => {
    try {
      const result = await analyticsApi.downloadExport('recovery');
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    }
  };

  if (isLoading) {
    return (
      <Card className="col-span-1 border shadow-sm lg:col-span-3">
        <CardHeader>
          <CardTitle>Physical-item cost recovery</CardTitle>
          <CardDescription>Loading item-level cost and rental revenue…</CardDescription>
        </CardHeader>
        <CardContent className="flex animate-pulse flex-col gap-4">
          <div className="h-4 w-1/4 rounded bg-muted" />
          <div className="h-6 w-full rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const data = response?.data;
  if (!data) return null;
  const recoveryPercentage = data.overallRecoveryPercentage ?? 0;

  return (
    <Card className="col-span-1 border bg-gradient-to-br from-white to-slate-50/50 shadow-sm lg:col-span-3">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-indigo-600" />
            Physical-item cost recovery
          </CardTitle>
          <CardDescription>
            Acquisition cost compared with rental revenue attributed to registered physical items
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="h-8 shadow-sm">
          <DownloadIcon className="mr-2 size-4" /> Export report
        </Button>
      </CardHeader>

      <CardContent>
        <div className="mb-6 flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="w-full">
            <div className="mb-2 flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Attributed rental revenue <FieldTip helpKey="analytics.attributedRevenue" />
                </span>
                <div className="font-mono text-3xl font-bold tracking-tight text-indigo-900">
                  {formatCurrency(data.totalAttributedRevenue)}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-sm font-medium text-muted-foreground">
                  Acquisition cost <FieldTip helpKey="analytics.costRecovery" />
                </span>
                <div className="font-mono text-xl font-medium text-muted-foreground">
                  {formatCurrency(data.totalAcquisitionCost)}
                </div>
              </div>
            </div>

            <div className="pt-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-block rounded-full bg-indigo-100/80 px-2 py-1 text-xs font-semibold uppercase text-indigo-600">
                  {data.overallRecoveryPercentage === null
                    ? 'Cost data incomplete'
                    : `${data.overallRecoveryPercentage.toFixed(1)}% recovered`}
                </span>
              </div>
              <Progress
                value={Math.min(recoveryPercentage, 100)}
                className={`h-3 bg-muted ${recoveryPercentage >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-600'}`}
              />
            </div>
          </div>

          <div className="flex w-full shrink-0 justify-around gap-4 pl-0 md:w-auto md:border-l md:pl-8">
            <div className="text-center">
              <div className="mb-1 text-2xl font-bold text-emerald-600">
                {data.recoveredProducts}
              </div>
              <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cost
                <br />
                recovered
              </div>
            </div>
            <div className="text-center">
              <div className="mb-1 text-2xl font-bold text-amber-500">
                {data.recoveringProducts}
              </div>
              <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Still
                <br />
                recovering
              </div>
            </div>
            <div className="text-center">
              <div className="mb-1 text-2xl font-bold text-slate-500">
                {data.incompleteProducts}
              </div>
              <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cost data
                <br />
                missing
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
