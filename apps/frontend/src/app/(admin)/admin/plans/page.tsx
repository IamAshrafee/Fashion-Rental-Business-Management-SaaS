'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { PlanFormDialog } from './components/plan-form-dialog';
import { useState } from 'react';
import { SubscriptionPlan } from '@closetrent/types';
import { AlertCircle } from 'lucide-react';

export default function SubscriptionPlansPage() {
  const { data: res, isLoading, error } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.getPlans(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const plans = res?.data || [];

  const handleCreate = () => {
    setSelectedPlan(null);
    setDialogOpen(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Subscription Plans"
          description="Manage standard SaaS subscription tiers for tenants."
        />
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Create Plan
        </button>
      </div>

      {/* Point 14: Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Failed to load subscription plans.</p>
        </div>
      )}

      {/* Points 12/13: Semantic tokens */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-6 shadow-sm">
              <div className="h-5 w-24 rounded bg-muted" />
              <div className="mt-4 h-4 w-16 rounded bg-muted" />
              <div className="mt-6 space-y-3">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : plans.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No plans found. Create your first subscription plan.
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="rounded-lg border bg-card p-6 shadow-sm flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-card-foreground">{plan.name}</h3>
                  <span className={`mt-1 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${plan.isActive ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30' : 'bg-muted text-muted-foreground ring-border'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  onClick={() => handleEdit(plan)}
                  className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                >
                  Edit
                </button>
              </div>

              <div className="mt-4 border-t border-border pt-4 flex-1">
                <p className="text-sm font-medium text-card-foreground">
                  <span className="text-2xl font-bold tracking-tight">৳{plan.priceMonthly}</span>
                  <span className="text-muted-foreground"> /mo</span>
                </p>

                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-card-foreground">Products:</span> {plan.maxProducts === null ? 'Unlimited' : plan.maxProducts}
                  </li>
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-card-foreground">Staff:</span> {plan.maxStaff}
                  </li>
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-card-foreground">Custom Domain:</span> {plan.customDomain ? 'Yes' : 'No'}
                  </li>
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-card-foreground">SMS Included:</span> {plan.smsEnabled ? 'Yes' : 'No'}
                  </li>
                </ul>
              </div>
            </div>
          ))
        )}
      </div>

      <PlanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={selectedPlan}
      />
    </div>
  );
}
