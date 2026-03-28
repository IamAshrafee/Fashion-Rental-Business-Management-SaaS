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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { SubscriptionPlan } from '@closetrent/types';

const planSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z.string().min(2, 'Slug is required'),
  priceMonthly: z.coerce.number().min(0),
  priceAnnual: z.coerce.number().min(0).nullable(),
  maxProducts: z.coerce.number().min(0).nullable(),
  maxStaff: z.coerce.number().min(0),
  customDomain: z.boolean(),
  smsEnabled: z.boolean(),
  analyticsFull: z.boolean(),
  removeBranding: z.boolean(),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().min(0),
});

type PlanFormValues = z.infer<typeof planSchema>;

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: SubscriptionPlan | null;
}

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
}: PlanFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!plan;

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          slug: plan.slug,
          priceMonthly: plan.priceMonthly,
          priceAnnual: plan.priceAnnual,
          maxProducts: plan.maxProducts,
          maxStaff: plan.maxStaff,
          customDomain: plan.customDomain,
          smsEnabled: plan.smsEnabled,
          analyticsFull: plan.analyticsFull,
          removeBranding: plan.removeBranding,
          isActive: plan.isActive,
          displayOrder: plan.displayOrder,
        }
      : {
          name: '',
          slug: '',
          priceMonthly: 0,
          priceAnnual: 0,
          maxProducts: 100, // Common default
          maxStaff: 1,
          customDomain: false,
          smsEnabled: false,
          analyticsFull: false,
          removeBranding: false,
          isActive: true,
          displayOrder: 1,
        },
  });

  const mutation = useMutation({
    mutationFn: (values: Partial<SubscriptionPlan>) =>
      isEditing
        ? adminApi.updatePlan(plan.id, values)
        : adminApi.createPlan(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      onOpenChange(false);
      form.reset();
    },
  });

  const onSubmit = (values: PlanFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details for this subscription plan.'
              : 'Add a new subscription tier for SaaS tenants.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Starter" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. starter" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priceMonthly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Price (BDT)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceAnnual"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                   <FormItem>
                    <FormLabel>Annual Price (BDT)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        value={value === null ? '' : value}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChange(val === '' ? null : Number(val));
                        }}  
                        {...fieldProps} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxProducts"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem>
                    <FormLabel>Max Products (Leave empty for Unlimited)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        value={value === null ? '' : value}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChange(val === '' ? null : Number(val));
                        }} 
                        {...fieldProps} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxStaff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Staff</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 rounded-md border p-4">
              <h4 className="text-sm font-medium">Features</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customDomain"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Custom Domain</FormLabel>
                        <FormDescription>Allow own domain naming</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="smsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>SMS Gateway</FormLabel>
                        <FormDescription>Enable SMS notifications</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="analyticsFull"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Full Analytics</FormLabel>
                        <FormDescription>Unlock advanced reports</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="removeBranding"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Remove Branding</FormLabel>
                        <FormDescription>Remove "Powered by ClosetRent"</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-2">
                      <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
                        <FormDescription>Make plan visible to tenants for subscribing</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Plan'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
