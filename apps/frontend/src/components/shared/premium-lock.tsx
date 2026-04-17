'use client';

import React from 'react';
import { useSubscription } from '@/app/(owner)/dashboard/settings/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface PremiumLockProps {
  /**
   * The property name on the SubscriptionPlan model to check.
   * e.g., 'customDomain', 'smsEnabled', 'analyticsFull', 'removeBranding'
   */
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PremiumLock({ featureKey, children, fallback }: PremiumLockProps) {
  const { data: response, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse bg-muted rounded-md h-32 w-full flex items-center justify-center">
        <Lock className="w-5 h-5 text-muted-foreground/30" />
      </div>
    );
  }

  const plan = response?.data?.plan;
  const hasFeature = plan ? plan[featureKey as keyof typeof plan] : false;

  if (hasFeature) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative group overflow-hidden rounded-md border border-dashed border-border/60 bg-muted/20 text-center flex flex-col items-center justify-center p-8">
      <Lock className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
      <h4 className="text-sm font-medium mb-1 text-foreground">Premium Feature Locked</h4>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm">
        This feature is not available on your current plan. To access it, please contact the network administrator to upgrade your store limits.
      </p>
      <Button variant="outline" size="sm" asChild>
        <a href={`mailto:admin@closetrent.com?subject=Upgrade Request: Unlock ${featureKey}`}>
          Contact Support to Upgrade
        </a>
      </Button>
    </div>
  );
}
