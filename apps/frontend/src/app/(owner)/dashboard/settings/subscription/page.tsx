'use client';

import React from 'react';
import { useSubscription } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function SubscriptionSettingsPage() {
  const { data: response, isLoading } = useSubscription();

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  const subscription = response?.data;
  const currentPlan = subscription?.plan;

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
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h4>
            <p className="text-sm text-muted-foreground mb-6">You are currently running without a synced plan feature set.</p>
            <Button>View Pricing Plans</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Subscription</h3>
        <p className="text-sm text-muted-foreground">Manage your plan and usage capacities.</p>
      </div>
      <Separator />

      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/50 pb-4 border-b">
          <CardTitle className="flex justify-between items-center text-xl text-indigo-900">
            {currentPlan.name} Plan
            <span className="text-sm px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
              {subscription.status.toUpperCase()}
            </span>
          </CardTitle>
          <CardDescription className="text-indigo-900/70">
            {currentPlan.priceMonthly === 0 ? 'Free tier' : `৳${currentPlan.priceMonthly} / month`}
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
        </CardContent>
      </Card>

      <div className="pt-4">
        <h4 className="text-sm font-semibold mb-4 text-gray-900">Resource Usage</h4>
        <div className="space-y-6">
        
          <div className="space-y-2 relative">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Products</span>
              <span className="text-muted-foreground">n/a / {currentPlan.maxProducts || 'Unlimited'}</span>
            </div>
            <Progress value={0} className="h-2 w-full" />
            <p className="text-xs text-muted-foreground">Product counts will populate when active items are evaluated.</p>
          </div>
          
          <div className="space-y-2 relative">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Staff Members</span>
              <span className="text-muted-foreground">n/a / {currentPlan.maxStaff}</span>
            </div>
            <Progress value={0} className="h-2 w-full" />
            <p className="text-xs text-muted-foreground">Max limit counts owners, managers and regular staff.</p>
          </div>
          
        </div>
      </div>
      
      <div className="flex gap-4 pt-6 border-t mt-8">
        <Button disabled>Upgrade Plan</Button>
        <Button variant="outline" disabled>View Invoices</Button>
      </div>
    </div>
  );
}
