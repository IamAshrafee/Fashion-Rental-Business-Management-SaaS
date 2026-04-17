'use client';

import React from 'react';
import { useSubscription, useResourceUsage } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BillingHistoryTable } from './billing-history';

export default function SubscriptionSettingsPage() {
  const { data: response, isLoading } = useSubscription();
  const { data: usageResponse } = useResourceUsage();

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  const subscription = response?.data;
  const currentPlan = subscription?.plan;
  const usage = usageResponse?.data;

  if (!currentPlan) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Billing & Subscription</h3>
          <p className="text-sm text-muted-foreground">Manage your plan and store features.</p>
        </div>
        <Separator />
        <Card className="border-dashed shadow-none bg-muted/30">
          <CardContent className="pt-6 flex flex-col items-center justify-center p-12 text-center">
            <h4 className="text-lg font-semibold text-foreground mb-2">No Active Subscription</h4>
            <p className="text-sm text-muted-foreground mb-6">You are currently running without a synced plan feature set.</p>
            <p className="text-xs text-muted-foreground">Contact your administrator to set up a subscription plan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse priceMonthly (Prisma Decimal comes as string)
  const priceMonthly = currentPlan.priceMonthly ? Number(currentPlan.priceMonthly) : 0;
  const priceAnnual = currentPlan.priceAnnual ? Number(currentPlan.priceAnnual) : null;

  // Compute resource usage percentages
  const productUsage = usage?.products;
  const staffUsage = usage?.staff;
  const orderUsage = usage?.orders;
  
  const productPercent = productUsage && productUsage.limit ? Math.round((productUsage.current / productUsage.limit) * 100) : 0;
  const staffPercent = staffUsage && staffUsage.limit ? Math.round((staffUsage.current / staffUsage.limit) * 100) : 0;
  const orderPercent = orderUsage && orderUsage.limit ? Math.round((orderUsage.current / orderUsage.limit) * 100) : 0;

  // Computed status display
  const computed = subscription?.computed;
  const statusLabel = computed?.status?.replace('_', ' ').toUpperCase() || subscription?.status?.toUpperCase();
  const statusColor = computed?.isActive
    ? computed?.isInGracePeriod ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Subscription</h3>
        <p className="text-sm text-muted-foreground">Manage your plan and usage capacities.</p>
      </div>
      <Separator />

      <Card className="border-indigo-100 dark:border-indigo-900/30 shadow-sm">
        <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 pb-4 border-b">
          <CardTitle className="flex justify-between items-center text-xl text-foreground">
            {currentPlan.name} Plan
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </CardTitle>
          <CardDescription>
            {priceMonthly === 0 ? 'Free tier' : `৳${priceMonthly.toLocaleString()} / month`}
            {priceAnnual !== null && priceMonthly > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                (৳{priceAnnual.toLocaleString()} / year)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500"/>
              <span>Up to {currentPlan.maxProducts || 'Unlimited'} Products</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500"/>
              <span>Up to {currentPlan.maxStaff} Staff Members</span>
            </div>
            
            <div className="flex items-center gap-2">
              {currentPlan.customDomain ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-muted-foreground/40"/>}
              <span className={!currentPlan.customDomain ? 'text-muted-foreground' : ''}>Custom Domain</span>
            </div>
            <div className="flex items-center gap-2">
              {currentPlan.smsEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-muted-foreground/40"/>}
              <span className={!currentPlan.smsEnabled ? 'text-muted-foreground' : ''}>SMS Notifications</span>
            </div>
            <div className="flex items-center gap-2">
              {currentPlan.analyticsFull ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-muted-foreground/40"/>}
              <span className={!currentPlan.analyticsFull ? 'text-muted-foreground' : ''}>Advanced Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              {currentPlan.removeBranding ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-muted-foreground/40"/>}
              <span className={!currentPlan.removeBranding ? 'text-muted-foreground' : ''}>Remove &quot;Powered by ClosetRent&quot;</span>
            </div>
          </div>

          {/* Computed status details */}
          {computed && (
            <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
              {computed.isInTrial && computed.daysRemaining > 0 && (
                <p className="text-amber-600">Trial period — {computed.daysRemaining} days remaining</p>
              )}
              {computed.isInGracePeriod && (
                <p className="text-amber-600">⚠️ Grace period active — please renew to avoid service interruption</p>
              )}
              {computed.isExpired && (
                <p className="text-red-600">⚠️ Subscription expired — some features may be restricted</p>
              )}
              {computed.daysRemaining > 0 && !computed.isInTrial && (
                <p>{computed.daysRemaining} days until renewal</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-4">
        <h4 className="text-sm font-semibold mb-4 text-foreground">Resource Usage</h4>
        <div className="space-y-6">
        
          <div className="space-y-2 relative">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-foreground">Products</span>
              <span className="text-muted-foreground">
                {productUsage ? `${productUsage.current}` : '—'} / {currentPlan.maxProducts || 'Unlimited'}
              </span>
            </div>
            <Progress
              value={currentPlan.maxProducts ? productPercent : 0}
              className="h-2 w-full"
            />
            {productUsage && currentPlan.maxProducts && productPercent >= 80 && (
              <p className="text-xs text-amber-600">You&apos;re approaching your product limit.</p>
            )}
          </div>
          
          <div className="space-y-2 relative">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-foreground">Staff Members</span>
              <span className="text-muted-foreground">
                {staffUsage ? `${staffUsage.current}` : '—'} / {currentPlan.maxStaff}
              </span>
            </div>
            <Progress
              value={currentPlan.maxStaff ? staffPercent : 0}
              className="h-2 w-full"
            />
            {staffUsage && currentPlan.maxStaff && staffPercent >= 80 && (
              <p className="text-xs text-amber-600">You&apos;re approaching your staff limit.</p>
            )}
          </div>
          
          <div className="space-y-2 relative">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-foreground">Monthly Orders</span>
              <span className="text-muted-foreground">
                {orderUsage ? `${orderUsage.current}` : '—'} / {currentPlan.maxOrders || 'Unlimited'}
              </span>
            </div>
            <Progress
              value={currentPlan.maxOrders ? orderPercent : 0}
              className="h-2 w-full"
            />
            {orderUsage && currentPlan.maxOrders && orderPercent >= 80 && (
              <p className="text-xs text-amber-600">You&apos;re approaching your monthly order limit.</p>
            )}
          </div>
          
        </div>
      </div>
      
      <div className="flex gap-4 pt-6 border-t mt-8">
        <Button asChild>
          <a href={`mailto:admin@closetrent.com?subject=Upgrade Plan Request - ${currentPlan.name}`}>
            Contact us to Upgrade
          </a>
        </Button>
      </div>

      <BillingHistoryTable />
    </div>
  );
}
