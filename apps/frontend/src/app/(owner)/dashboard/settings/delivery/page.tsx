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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStoreSettings, useUpdateCourierSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';

const courierSchema = z.object({
  defaultCourier: z.string().optional(),
  courierApiKey: z.string().max(255).optional(),
  courierSecretKey: z.string().max(255).optional(),
  pickupAddress: z.string().optional(),
});

type CourierValues = z.infer<typeof courierSchema>;

export default function CourierSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updateCourier = useUpdateCourierSettings();

  const settingsData = response?.data;

  const form = useForm<CourierValues>({
    resolver: zodResolver(courierSchema),
    values: settingsData ? {
      defaultCourier: settingsData.defaultCourier || 'pathao',
      courierApiKey: settingsData.courierApiKey || '',
      courierSecretKey: settingsData.courierSecretKey || '',
      pickupAddress: settingsData.pickupAddress || '',
    } : undefined,
    defaultValues: {
      defaultCourier: '',
      courierApiKey: '',
      courierSecretKey: '',
      pickupAddress: '',
    },
  });

  const onSubmit = (data: CourierValues) => {
    updateCourier.mutate(data);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Delivery & Couriers</h3>
        <p className="text-sm text-muted-foreground">
          Connect your local delivery APIs for tracking and automated logistics.
        </p>
      </div>
      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="defaultCourier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Courier Partner</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select courier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pathao">Pathao Delivery</SelectItem>
                        <SelectItem value="steadfast">Steadfast Logistics</SelectItem>
                        <SelectItem value="paperfly">Paperfly</SelectItem>
                        <SelectItem value="redx">RedX</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <FormField
              control={form.control}
              name="courierApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g. key_xxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="courierSecretKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Secret</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="pickupAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hub Pickup Address</FormLabel>
                <FormControl>
                  <Textarea placeholder="123 Warehouse Rd, Block B..." className="resize-none min-h-[100px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={updateCourier.isPending}>
              {updateCourier.isPending ? 'Saving...' : 'Save Courier Profile'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
