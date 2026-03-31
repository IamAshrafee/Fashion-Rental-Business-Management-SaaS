'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CreditCard, Shield, Package, Users, Clock,
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  TrendingUp, Phone, ArrowRight,
} from 'lucide-react';

/** Format paisa to BDT display */
function formatMoney(paisa: number) {
  return `৳${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 0 })}`;
}

interface SubscriptionData {
  id: string;
  plan: {
    id: string;
    name: string;
    slug: string;
    priceMonthly: number;
    priceAnnual: number | null;
    maxProducts: number | null;
    maxStaff: number;
    customDomain: boolean;
    smsEnabled: boolean;
    analyticsFull: boolean;
    removeBranding: boolean;
  };
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  computed: {
    isActive: boolean;
    isInTrial: boolean;
    isInGracePeriod: boolean;
    isExpired: boolean;
    daysRemaining: number;
    status: string;
  };
}

interface ResourceUsage {
  products: { allowed: boolean; current: number; limit: number | null };
  staff: { allowed: boolean; current: number; limit: number | null };
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [subRes, usageRes] = await Promise.all([
        apiClient.get('/tenant/subscription'),
        apiClient.get('/tenant/resource-usage'),
      ]);
      setSubscription(subRes.data.data ?? subRes.data);
      setUsage(usageRes.data.data ?? usageRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function getStatusConfig(status: string) {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          icon: CheckCircle2,
          color: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
          iconColor: 'text-green-600',
        };
      case 'trial':
        return {
          label: 'Trial',
          icon: Clock,
          color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
          iconColor: 'text-blue-600',
        };
      case 'grace_period':
        return {
          label: 'Grace Period',
          icon: AlertTriangle,
          color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
          iconColor: 'text-amber-600',
        };
      case 'expired':
        return {
          label: 'Expired',
          icon: XCircle,
          color: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
          iconColor: 'text-red-600',
        };
      default:
        return {
          label: status,
          icon: CreditCard,
          color: 'bg-muted text-muted-foreground border-border',
          iconColor: 'text-muted-foreground',
        };
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading billing info...</p>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Manage your subscription and plan</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No Subscription Found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              {error || 'Your account doesn\'t have an active subscription. Contact support to get started.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(subscription.computed.status);
  const StatusIcon = statusConfig.icon;
  const plan = subscription.plan;
  const isFree = plan.slug === 'free';
  const daysRemaining = subscription.computed.daysRemaining;

  // Features list from plan
  const features = [
    { label: 'Products', value: plan.maxProducts === null ? 'Unlimited' : `Up to ${plan.maxProducts}`, available: true },
    { label: 'Staff Members', value: `Up to ${plan.maxStaff}`, available: plan.maxStaff > 0 },
    { label: 'Custom Domain', value: plan.customDomain ? 'Included' : 'Not available', available: plan.customDomain },
    { label: 'SMS Notifications', value: plan.smsEnabled ? 'Included' : 'Not available', available: plan.smsEnabled },
    { label: 'Full Analytics', value: plan.analyticsFull ? 'Included' : 'Basic only', available: plan.analyticsFull },
    { label: 'Remove Branding', value: plan.removeBranding ? 'Yes' : 'No', available: plan.removeBranding },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and plan usage</p>
      </div>

      {/* Status Banner */}
      {subscription.computed.isInGracePeriod && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              Subscription Expired — Grace Period Active
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-500 mt-0.5">
              Your subscription has expired. You&apos;re in a 7-day grace period. Please contact your account manager 
              to renew and avoid service interruption.
            </p>
          </div>
        </div>
      )}
      {subscription.computed.isExpired && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-400">
              Subscription Expired
            </p>
            <p className="text-sm text-red-700 dark:text-red-500 mt-0.5">
              Your subscription has expired. Some features may be limited. Please contact support to renew.
            </p>
          </div>
        </div>
      )}

      {/* Subscription Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>
                  {isFree ? 'Free forever — no payment required' : `Billed ${subscription.billingCycle}`}
                </CardDescription>
              </div>
              <Badge variant="outline" className={statusConfig.color}>
                <StatusIcon className={`mr-1 h-3 w-3 ${statusConfig.iconColor}`} />
                {statusConfig.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold tracking-tight">{plan.name}</p>
                {!isFree && (
                  <p className="text-muted-foreground mt-1">
                    {formatMoney(plan.priceMonthly)}/mo
                    {plan.priceAnnual && ` • ${formatMoney(plan.priceAnnual)}/yr`}
                  </p>
                )}
              </div>

              {!isFree && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Period Start</p>
                    <p className="font-medium text-sm">
                      {new Date(subscription.currentPeriodStart).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Period End</p>
                    <p className="font-medium text-sm">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Days Remaining</p>
                    <p className={`font-bold text-sm ${
                      daysRemaining > 36000 ? 'text-green-600' :
                      daysRemaining < 7 ? 'text-red-600' :
                      daysRemaining < 14 ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                      {daysRemaining > 36000 ? '∞ (Perpetual)' : daysRemaining}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Billing Cycle</p>
                    <p className="font-medium text-sm capitalize">{subscription.billingCycle}</p>
                  </div>
                </div>
              )}

              {subscription.computed.isInTrial && subscription.trialEndsAt && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 mt-2">
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
                    <span className="font-semibold"> ({daysRemaining} days left)</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resource Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resource Usage</CardTitle>
            <CardDescription>Your current usage vs plan limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {usage && (
              <>
                {/* Products */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Products</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage.products.current}
                      {usage.products.limit !== null ? ` / ${usage.products.limit}` : ' (Unlimited)'}
                    </span>
                  </div>
                  {usage.products.limit !== null && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usage.products.current / usage.products.limit > 0.9
                            ? 'bg-red-500'
                            : usage.products.current / usage.products.limit > 0.7
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{
                          width: `${Math.min(100, (usage.products.current / usage.products.limit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  {usage.products.limit !== null && !usage.products.allowed && (
                    <p className="text-xs text-red-600 mt-1">Limit reached — upgrade to add more products</p>
                  )}
                </div>

                {/* Staff */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Staff Members</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage.staff.current}
                      {usage.staff.limit !== null && usage.staff.limit > 0 ? ` / ${usage.staff.limit}` : ' (Unlimited)'}
                    </span>
                  </div>
                  {usage.staff.limit !== null && usage.staff.limit > 0 && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usage.staff.current / usage.staff.limit > 0.9
                            ? 'bg-red-500'
                            : usage.staff.current / usage.staff.limit > 0.7
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{
                          width: `${Math.min(100, (usage.staff.current / usage.staff.limit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan Features</CardTitle>
          <CardDescription>What&apos;s included in your {plan.name} plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {features.map((feature) => (
              <div
                key={feature.label}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  feature.available
                    ? 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  feature.available
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : 'bg-muted'
                }`}>
                  {feature.available ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      {!isFree ? null : (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Upgrade Your Plan</p>
                <p className="text-sm text-muted-foreground">
                  Get more products, staff members, custom domain, and SMS notifications.
                </p>
              </div>
            </div>
            <Button variant="default" className="gap-2">
              <Phone className="h-4 w-4" />
              Contact Admin
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contact Support */}
      <Card>
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium">Need to change your plan or have billing questions?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contact our team — we handle all plan changes manually to ensure the best experience.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0">
            <Phone className="h-3.5 w-3.5" />
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
