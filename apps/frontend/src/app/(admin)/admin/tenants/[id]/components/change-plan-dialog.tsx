'use client';

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
import { SubscriptionPlan } from '@closetrent/types';
import { useToast } from '@/hooks/use-toast';

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

// ─────────────────────────────────────────────────────────────────────────────
// INNER FORM — only mounts when plans are loaded.
// Uses defaultValues so Radix Select triggers mount with the correct value.
// key={currentPlanId} forces remount if the current plan prop changes.
// ─────────────────────────────────────────────────────────────────────────────
function ChangePlanForm({
  tenantId,
  currentPlanId,
  plans,
  onOpenChange,
}: {
  tenantId: string;
  currentPlanId?: string;
  plans: SubscriptionPlan[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<ChangePlanFormValues>({
    resolver: zodResolver(changePlanSchema),
    defaultValues: {
      planId: currentPlanId || '',
      billingCycle: 'monthly',
    },
  });

  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (values: ChangePlanFormValues) =>
      adminApi.updateTenantPlan(tenantId, values.planId, values.billingCycle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', tenantId] });
      toast({ title: 'Plan updated', description: 'Tenant subscription plan changed successfully.' });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Failed to update plan', description: 'Something went wrong.', variant: 'destructive' });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <FormField
          control={form.control}
          name="planId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subscription Plan</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.isActive).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} (৳{plan.priceMonthly}/mo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
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
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Updating...' : 'Update Plan'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTER DIALOG — waits for plans to load, then mounts ChangePlanForm.
// key forces remount whenever the resolved planId changes.
// ─────────────────────────────────────────────────────────────────────────────
export function ChangePlanDialog({
  tenantId,
  currentPlanId,
  open,
  onOpenChange,
}: ChangePlanDialogProps) {
  const { data: plansRes, isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.getPlans(),
    enabled: open,
  });

  const plans = plansRes?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Tenant Plan</DialogTitle>
          <DialogDescription>
            Upgrade or downgrade this tenant to a different subscription plan.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <div className="animate-pulse h-32 bg-muted rounded-md" />}

        {!isLoading && plans.length > 0 && (
          // key ensures form remounts fresh when plans or currentPlanId changes
          <ChangePlanForm
            key={`${currentPlanId}-${plans.map((p) => p.id).join(',')}`}
            tenantId={tenantId}
            currentPlanId={currentPlanId}
            plans={plans}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
