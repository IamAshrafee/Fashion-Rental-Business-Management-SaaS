'use client';

import React from 'react';
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
import { useStoreSettings, useUpdateOperationalSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';

const operationalSchema = z.object({
  maxConcurrentSessions: z.coerce.number().min(1).max(100).default(5),
  bufferDays: z.coerce.number().min(0).max(30).default(3),
  smsEnabled: z.boolean().default(false),
});

type OperationalValues = z.infer<typeof operationalSchema>;

export default function OperationalSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updateOperational = useUpdateOperationalSettings();

  const settingsData = response?.data;

  const form = useForm<OperationalValues>({
    resolver: zodResolver(operationalSchema),
    values: settingsData ? {
      maxConcurrentSessions: settingsData.maxConcurrentSessions ?? 5,
      bufferDays: settingsData.bufferDays ?? 3,
      smsEnabled: settingsData.smsEnabled ?? false,
    } : undefined,
    defaultValues: {
      maxConcurrentSessions: 5,
      bufferDays: 3,
      smsEnabled: false,
    },
  });

  const onSubmit = (data: OperationalValues) => {
    updateOperational.mutate(data);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Operational & Security Rules</h3>
        <p className="text-sm text-muted-foreground">
          Define inventory buffer periods and secure staff logins.
        </p>
      </div>
      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-foreground border-b pb-2">Booking Logistics</h4>
            <div className="grid grid-cols-1 pt-4">
              <FormField
                control={form.control}
                name="bufferDays"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Inventory Buffer Days</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={30} {...field} />
                    </FormControl>
                    <FormDescription>
                      Added padding before and after a booking period to handle laundering and delivery buffers automatically checking-out items as &quot;in use&quot;.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="text-md font-semibold text-foreground border-b pb-2">Auth & Sessions</h4>
            <div className="grid grid-cols-1 pt-4">
              <FormField
                control={form.control}
                name="maxConcurrentSessions"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Max Concurrent Devices per User</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={100} {...field} />
                    </FormControl>
                    <FormDescription>
                      Limits how many distinct devices a single staff or owner can be logged into simultaneously. Prevents credential sharing.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="text-md font-semibold text-foreground border-b pb-2">Notification Webhooks</h4>
            <div className="grid grid-cols-1 pt-4">
              <FormField
                control={form.control}
                name="smsEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-foreground">Enable SMS Triggers</FormLabel>
                      <FormDescription>
                        Triggers Outbound SMS pings for booking confirmations and overdues. Active Subscriptions may be billed per limit.
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
            <Button type="submit" disabled={updateOperational.isPending}>
              {updateOperational.isPending ? 'Saving...' : 'Save Ops Configuration'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
