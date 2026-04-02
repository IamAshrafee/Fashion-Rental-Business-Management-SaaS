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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStoreSettings, useUpdateCourierSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Truck, Shield, TestTube } from 'lucide-react';
import type { StoreSettings } from '@closetrent/types';

const courierSchema = z.object({
  defaultCourier: z.string().optional(),
  pickupAddress: z.string().optional(),
  // Pathao-specific
  pathaoClientId: z.string().max(255).optional(),
  pathaoClientSecret: z.string().max(255).optional(),
  pathaoUsername: z.string().max(255).optional(),
  pathaoPassword: z.string().max(255).optional(),
  pathaoStoreId: z.coerce.number().int().optional(),
  pathaoSandbox: z.boolean().optional(),
  // Legacy (for Steadfast / others)
  courierApiKey: z.string().max(255).optional(),
  courierSecretKey: z.string().max(255).optional(),
});

type CourierValues = z.infer<typeof courierSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// INNER FORM — only ever mounts once data is present.
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryForm({ data }: { data: StoreSettings }) {
  const updateCourier = useUpdateCourierSettings();

  const form = useForm<CourierValues>({
    resolver: zodResolver(courierSchema),
    defaultValues: {
      defaultCourier: data.defaultCourier || 'pathao',
      pickupAddress: data.pickupAddress || '',
      pathaoClientId: data.pathaoClientId || '',
      pathaoClientSecret: data.pathaoClientSecret || '',
      pathaoUsername: data.pathaoUsername || '',
      pathaoPassword: data.pathaoPassword || '',
      pathaoStoreId: data.pathaoStoreId || undefined,
      pathaoSandbox: data.pathaoSandbox || false,
      courierApiKey: data.courierApiKey || '',
      courierSecretKey: data.courierSecretKey || '',
    },
  });

  const selectedCourier = form.watch('defaultCourier');
  const isSandbox = form.watch('pathaoSandbox');

  const onSubmit = (values: CourierValues) => {
    updateCourier.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* ── General ────────────────────────────────────────────────── */}
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
                      <SelectItem value="manual">Manual / Self-delivery</SelectItem>
                    </SelectContent>
                  </Select>
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
              <FormLabel>Pickup Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Full address where courier picks up parcels..." className="resize-none min-h-[80px]" {...field} />
              </FormControl>
              <FormDescription>
                The address where the courier will pick up parcels from your store/warehouse.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Pathao Credentials ─────────────────────────────────────── */}
        {selectedCourier === 'pathao' && (
          <>
            <Separator />
            <Card className="border-primary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Pathao Courier API</CardTitle>
                    <CardDescription>
                      Enter your Pathao merchant credentials to enable automated pickup and tracking.
                    </CardDescription>
                  </div>
                  {isSandbox && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      <TestTube className="h-3 w-3 mr-1" />
                      Sandbox Mode
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="pathaoClientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. YQdJP0yaOG" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pathaoClientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="pathaoUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merchant Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Your Pathao merchant portal login email.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pathaoPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merchant Password</FormLabel>
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
                  name="pathaoStoreId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store ID</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g. 150139"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Your Pathao store/merchant ID. Find this in the Pathao merchant dashboard or use the sandbox test script.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="pathaoSandbox"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          <div className="flex items-center gap-2">
                            <TestTube className="h-4 w-4" />
                            Sandbox / Test Mode
                          </div>
                        </FormLabel>
                        <FormDescription>
                          When enabled, all API calls go to Pathao&apos;s sandbox environment. 
                          Use sandbox credentials for testing. Disable for live shipments.
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
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Steadfast / Generic Credentials ────────────────────────── */}
        {selectedCourier === 'steadfast' && (
          <>
            <Separator />
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Steadfast API</CardTitle>
                    <CardDescription>
                      Enter your Steadfast API key and secret.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={updateCourier.isPending}>
            {updateCourier.isPending ? 'Saving...' : 'Save Courier Settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTER PAGE — waits for data, then mounts DeliveryForm with a key.
// ─────────────────────────────────────────────────────────────────────────────
export default function CourierSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Delivery &amp; Couriers</h3>
        <p className="text-sm text-muted-foreground">
          Configure your courier partner API credentials for automated pickup scheduling and real-time order tracking.
        </p>
      </div>
      <Separator />

      {isLoading && <div className="animate-pulse h-64 bg-muted rounded-md" />}

      {!isLoading && response?.data && (
        <DeliveryForm key={response.data.updatedAt} data={response.data} />
      )}
    </div>
  );
}
