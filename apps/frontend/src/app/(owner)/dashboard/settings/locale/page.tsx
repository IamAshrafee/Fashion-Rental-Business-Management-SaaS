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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStoreSettings, useUpdateLocaleSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';
import type { StoreSettings } from '@closetrent/types';

const localeSchema = z.object({
  defaultLanguage: z.string().min(2),
  timezone: z.string().min(1),
  country: z.string().min(2),
  currencyCode: z.string().min(3),
  currencySymbol: z.string().min(1),
  currencyPosition: z.enum(['before', 'after']),
  numberFormat: z.enum(['south_asian', 'international']),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  timeFormat: z.enum(['12h', '24h']),
  weekStart: z.enum(['saturday', 'sunday', 'monday']),
});

type LocaleValues = z.infer<typeof localeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// INNER FORM — only ever mounts once data is already present.
// Uses defaultValues (not values) so Radix Select triggers never face a
// stale-value mismatch on re-render. The `key` on the outer component
// ensures this remounts if the fetched data changes.
// ─────────────────────────────────────────────────────────────────────────────
function LocaleForm({ data }: { data: StoreSettings }) {
  const updateLocale = useUpdateLocaleSettings();

  const form = useForm<LocaleValues>({
    resolver: zodResolver(localeSchema),
    defaultValues: {
      defaultLanguage: data.defaultLanguage || 'en',
      timezone:        data.timezone        || 'UTC',
      country:         data.country         || 'BD',
      currencyCode:    data.currencyCode    || 'BDT',
      currencySymbol:  data.currencySymbol  || '৳',
      currencyPosition: data.currencyPosition || 'before',
      numberFormat:    data.numberFormat    || 'south_asian',
      dateFormat:      data.dateFormat      || 'DD/MM/YYYY',
      timeFormat:      data.timeFormat      || '12h',
      weekStart:       data.weekStart       || 'saturday',
    },
  });

  const onSubmit = (values: LocaleValues) => {
    updateLocale.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC (Universal)</SelectItem>
                      <SelectItem value="Asia/Dhaka">Asia/Dhaka (BDT)</SelectItem>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="IN">India</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="UK">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="currencyCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency Code</FormLabel>
                <FormControl><Input placeholder="BDT" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currencySymbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency Symbol</FormLabel>
                <FormControl><Input placeholder="৳" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currencyPosition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Symbol Position</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before Amount (৳50)</SelectItem>
                      <SelectItem value="after">After Amount (50৳)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="dateFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date Format</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timeFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Format</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24-Hour</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numberFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number Format</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="south_asian">South Asian (1,00,000)</SelectItem>
                      <SelectItem value="international">International (100,000)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weekStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Day of Week</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                      <SelectItem value="monday">Monday</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={updateLocale.isPending}>
            {updateLocale.isPending ? 'Saving...' : 'Save Locale'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTER PAGE — waits for data, then mounts LocaleForm with a key derived from
// updatedAt so the form always remounts fresh after a successful save.
// ─────────────────────────────────────────────────────────────────────────────
export default function LocaleSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Locale &amp; Formats</h3>
        <p className="text-sm text-muted-foreground">
          Update your store&apos;s regional logic and display rules.
        </p>
      </div>
      <Separator />

      {isLoading && <div className="animate-pulse h-64 bg-muted rounded-md" />}

      {!isLoading && response?.data && (
        // key forces a full remount when the server data changes (e.g. after save),
        // guaranteeing Radix Select triggers always reflect the latest saved value.
        <LocaleForm key={response.data.updatedAt} data={response.data} />
      )}
    </div>
  );
}
