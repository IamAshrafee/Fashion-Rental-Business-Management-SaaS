'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useStoreSettings, useUpdatePaymentSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';

const paymentSchema = z.object({
  bkashNumber: z.string().max(20).optional(),
  nagadNumber: z.string().max(20).optional(),
  sslcommerzStoreId: z.string().max(100).optional(),
  sslcommerzStorePass: z.string().max(255).optional(),
  sslcommerzSandbox: z.boolean().default(true),
});

type PaymentValues = z.infer<typeof paymentSchema>;

export default function PaymentSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updatePayment = useUpdatePaymentSettings();

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      bkashNumber: '',
      nagadNumber: '',
      sslcommerzStoreId: '',
      sslcommerzStorePass: '',
      sslcommerzSandbox: true,
    },
  });

  useEffect(() => {
    if (response?.data) {
      const d = response.data;
      form.reset({
        bkashNumber: d.bkashNumber || '',
        nagadNumber: d.nagadNumber || '',
        sslcommerzStoreId: d.sslcommerzStoreId || '',
        sslcommerzStorePass: d.sslcommerzStorePass || '',
        sslcommerzSandbox: d.sslcommerzSandbox ?? true,
      });
    }
  }, [response?.data, form]);

  const onSubmit = (data: PaymentValues) => {
    updatePayment.mutate(data);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Payment Methods</h3>
        <p className="text-sm text-muted-foreground">
          Configure how your customers can pay you for their bookings.
        </p>
      </div>
      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900 border-b pb-2">Manual Payments (Mobile Banking)</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <FormField
                control={form.control}
                name="bkashNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>bKash Merchant/Personal Number</FormLabel>
                    <FormControl>
                      <Input placeholder="01712345678" {...field} />
                    </FormControl>
                    <FormDescription>
                      Customers will see this number at checkout instructions.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nagadNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nagad Merchant/Personal Number</FormLabel>
                    <FormControl>
                      <Input placeholder="01712345678" {...field} />
                    </FormControl>
                    <FormDescription>
                      Customers will see this number at checkout instructions.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="text-md font-semibold text-gray-900 border-b pb-2">Online Payments (SSLCommerz)</h4>
            
            <div className="grid grid-cols-1 gap-6 pt-4">
              <FormField
                control={form.control}
                name="sslcommerzStoreId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store ID</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. hana_123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sslcommerzStorePass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sslcommerzSandbox"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Sandbox Mode</FormLabel>
                      <FormDescription>
                        When active, SSLCommerz uses test environment domains. Disable before launching.
                      </FormDescription>
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

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={updatePayment.isPending}>
              {updatePayment.isPending ? 'Saving...' : 'Save Payment Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
