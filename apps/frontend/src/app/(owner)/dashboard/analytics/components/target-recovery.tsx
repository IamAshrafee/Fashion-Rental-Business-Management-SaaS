'use client';

import { useTargetRecovery } from '../hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TargetRecovery() {
  const { data: response, isLoading } = useTargetRecovery();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = () => {
    window.location.href = `/api/v1/owner/analytics/export/recovery`;
  };

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-3 border shadow-sm">
        <CardHeader>
          <CardTitle>Target Recovery</CardTitle>
          <CardDescription>Loading recovery tracking...</CardDescription>
        </CardHeader>
        <CardContent className="animate-pulse space-y-4">
          <div className="h-4 bg-muted w-1/4 rounded mb-2"></div>
          <div className="h-6 bg-muted w-full rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const data = response?.data;
  if (!data) return null;

  return (
    <Card className="col-span-1 lg:col-span-3 border shadow-sm bg-gradient-to-br from-white to-slate-50/50">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Target Recovery
          </CardTitle>
          <CardDescription>Overall tracking of investment vs returns</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="h-8 shadow-sm">
          <DownloadIcon className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between mb-6">
          <div className="w-full">
            <div className="flex justify-between items-end mb-2">
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Total Recovered</span>
                <div className="text-3xl font-bold font-mono tracking-tight text-indigo-900">
                  {formatCurrency(data.totalRecovered)}
                </div>
              </div>
              <div className="text-right space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Total Target</span>
                <div className="text-xl font-medium text-muted-foreground font-mono">
                  {formatCurrency(data.totalInvestment)}
                </div>
              </div>
            </div>
            
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-100/80">
                    {data.overallRecoveryPercentage.toFixed(1)}% RECOVERED
                  </span>
                </div>
              </div>
              <Progress 
                value={Math.min(data.overallRecoveryPercentage, 100)} 
                className={`h-3 bg-muted ${data.overallRecoveryPercentage >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-600'}`} 
              />
            </div>
          </div>
          
          <div className="flex gap-4 md:border-l pl-0 md:pl-8 w-full md:w-auto shrink-0 justify-around">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 mb-1">{data.productsAtTarget}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
                At<br/>Target
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500 mb-1">{data.productsBelowTarget}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Still<br/>Recovering
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
