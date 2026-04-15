'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { AlertCircle, Server, Activity, Database, CheckCircle2 } from 'lucide-react';

export default function ResourceMonitorPage() {
  const { data: overviewRes, isLoading, error } = useQuery({
    queryKey: ['admin', 'resourceMonitor'],
    queryFn: () => adminApi.getResourceMonitorOverview(),
    refetchInterval: 15000, // Refresh every 15s to catch spikes
  });

  const overview = overviewRes?.data;
  const tenants = overview?.tenants || [];
  const summary = overview?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Resource Monitor"
          description="Real-time multi-tenant resource governance & observability"
        />
        {summary && (
          <div className="flex space-x-2">
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {summary.redCount} Critical
            </span>
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              {summary.yellowCount} Warning
            </span>
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {summary.totalActiveTenants - summary.alertCount} Healthy
            </span>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Failed to load resource metrics</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border bg-card p-6 shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {tenants.map((tenant: any) => (
            <div
              key={tenant.tenantId}
              className={`rounded-lg border bg-card p-6 shadow-sm transition-all ${
                tenant.alertLevel === 'red'
                  ? 'border-red-500 shadow-red-500/20'
                  : tenant.alertLevel === 'yellow'
                  ? 'border-yellow-500 shadow-yellow-500/20'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{tenant.businessName}</h3>
                    <span className="text-sm text-muted-foreground">({tenant.subdomain})</span>
                    {tenant.alertLevel === 'red' && (
                      <span className="ml-2 inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-300">
                        High Utilization
                      </span>
                    )}
                    {tenant.alertLevel === 'green' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Plan: <span className="font-medium text-foreground">{tenant.plan?.name || 'Unknown'}</span>
                  </p>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {tenant.utilization.overallPct}% <span className="text-sm font-normal text-muted-foreground">peak utilization</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {/* API Request Rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium text-muted-foreground">
                      <Activity className="h-4 w-4" /> RPM Burst
                    </div>
                    <span className={tenant.utilization.rpmPct >= 90 ? 'text-red-500 font-bold' : ''}>
                      {tenant.live.currentRpm} / {tenant.limits.maxRpm}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all ${
                        tenant.utilization.rpmPct >= 90 ? 'bg-red-500' : tenant.utilization.rpmPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(tenant.utilization.rpmPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Daily API Quota */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium text-muted-foreground">
                      <Server className="h-4 w-4" /> Daily API Quota
                    </div>
                    <span className={tenant.utilization.apiPct >= 90 ? 'text-red-500 font-bold' : ''}>
                      {tenant.live.apiCallsToday.toLocaleString()} / {tenant.limits.maxApiCallsDaily ? tenant.limits.maxApiCallsDaily.toLocaleString() : '∞'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all ${
                        tenant.utilization.apiPct >= 90 ? 'bg-red-500' : tenant.utilization.apiPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(tenant.utilization.apiPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium text-muted-foreground">
                      <Database className="h-4 w-4" /> Storage Usage
                    </div>
                    <span className={tenant.utilization.storagePct >= 90 ? 'text-red-500 font-bold' : ''}>
                      {tenant.resources.storageUsedMb} MB / {tenant.limits.maxStorageMb ? `${tenant.limits.maxStorageMb} MB` : '∞'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all ${
                        tenant.utilization.storagePct >= 90 ? 'bg-red-500' : tenant.utilization.storagePct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(tenant.utilization.storagePct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Additional diagnostics */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
                <div>Avg Latency: <span className="font-medium text-foreground">{tenant.live.avgLatencyMs} ms</span></div>
                <div>Errors Today: <span className="font-medium text-foreground">{tenant.live.errorsToday}</span></div>
                <div>Bandwidth: <span className="font-medium text-foreground">{tenant.live.bandwidthKbToday} KB</span></div>
                <div>Products: <span className="font-medium text-foreground">{tenant.resources.productCount}</span></div>
                <div>Bookings: <span className="font-medium text-foreground">{tenant.resources.bookingCount}</span></div>
              </div>
            </div>
          ))}
          
          {tenants.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No active tenants found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
