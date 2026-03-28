'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { PlanFormDialog } from './components/plan-form-dialog';
import { useState } from 'react';
import { SubscriptionPlan } from '@closetrent/types';

export default function SubscriptionPlansPage() {
  const { data: res, isLoading } = useQuery({
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
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Create Plan
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div>Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-gray-500">
            No plans found.
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="rounded-lg border bg-white p-6 shadow-sm flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <span className={`mt-1 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${plan.isActive ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-gray-50 text-gray-600 ring-gray-500/10'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button 
                  onClick={() => handleEdit(plan)}
                  className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                >
                  Edit
                </button>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  <span className="text-2xl font-bold tracking-tight">৳{plan.priceMonthly}</span>
                  <span className="text-gray-500"> /mo</span>
                </p>

                <ul className="mt-4 space-y-3 text-sm text-gray-600">
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-gray-900">Products:</span> {plan.maxProducts === null ? 'Unlimited' : plan.maxProducts}
                  </li>
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-gray-900">Staff:</span> {plan.maxStaff}
                  </li>
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-gray-900">Custom Domain:</span> {plan.customDomain ? 'Yes' : 'No'}
                  </li>
                  <li className="flex gap-x-3">
                    <span className="font-semibold text-gray-900">SMS Included:</span> {plan.smsEnabled ? 'Yes' : 'No'}
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
