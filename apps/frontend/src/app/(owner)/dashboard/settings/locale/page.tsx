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
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStoreSettings, useUpdateLocaleSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';

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

export default function LocaleSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updateLocale = useUpdateLocaleSettings();

  const form = useForm<LocaleValues>({
    resolver: zodResolver(localeSchema),
    defaultValues: {
      defaultLanguage: 'en',
      timezone: 'UTC',
      country: 'BD',
      currencyCode: 'BDT',
      currencySymbol: '৳',
      currencyPosition: 'before',
      numberFormat: 'south_asian',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      weekStart: 'saturday',
    },
  });

  useEffect(() => {
    if (response?.data) {
      const d = response.data;
      form.reset({
        defaultLanguage: d.defaultLanguage || 'en',
        timezone: d.timezone || 'UTC',
        country: d.country || 'BD',
        currencyCode: d.currencyCode || 'BDT',
        currencySymbol: d.currencySymbol || '৳',
        currencyPosition: d.currencyPosition || 'before',
        numberFormat: d.numberFormat || 'south_asian',
        dateFormat: d.dateFormat || 'DD/MM/YYYY',
        timeFormat: d.timeFormat || '12h',
        weekStart: d.weekStart || 'saturday',
      });
    }
  }, [response?.data, form]);

  const onSubmit = (data: LocaleValues) => {
    updateLocale.mutate(data);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Locale & Formats</h3>
        <p className="text-sm text-muted-foreground">
          Update your store&apos;s regional logic and display rules.
        </p>
      </div>
      <Separator />

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
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
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
                  <FormControl>
                    <Input placeholder="BDT" {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input placeholder="৳" {...field} />
                  </FormControl>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
    </div>
  );
}
