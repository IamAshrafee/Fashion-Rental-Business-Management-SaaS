'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { BillingCycle, SubscriptionPlan } from '@closetrent/types';

const changePlanSchema = z.object({
  planId: z.string().min(1, 'Please select a plan'),
  billingCycle: z.enum(['monthly', 'annual']),
});

type ChangePlanFormValues = z.infer<typeof changePlanSchema>;

interface ChangePlanDialogProps {
  tenantId: string;
  currentPlanId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePlanDialog({
  tenantId,
  currentPlanId,
  open,
  onOpenChange,
}: ChangePlanDialogProps) {
  const queryClient = useQueryClient();

  const { data: plansRes, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.getPlans(),
    enabled: open,
  });

  const plans = plansRes?.data || [];

  const form = useForm<ChangePlanFormValues>({
    resolver: zodResolver(changePlanSchema),
    defaultValues: {
      planId: currentPlanId || '',
      billingCycle: 'monthly',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePlanFormValues) =>
      adminApi.updateTenantPlan(tenantId, values.planId, values.billingCycle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', tenantId] });
      // Toast notification would be ideal here if a toast system is in place
      alert('Plan updated successfully');
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      alert('Failed to update plan');
    }
  });

  const onSubmit = (values: ChangePlanFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Tenant Plan</DialogTitle>
          <DialogDescription>
            Upgrade or downgrade this tenant to a different subscription plan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="planId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Plan</FormLabel>
                  <Select
                    disabled={isLoadingPlans}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plans.filter(p => p.isActive).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} (৳{plan.priceMonthly}/mo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingCycle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Cycle</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select billing cycle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Updating...' : 'Update Plan'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
