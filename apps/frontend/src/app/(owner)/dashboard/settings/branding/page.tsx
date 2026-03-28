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
import { useStoreSettings, useUpdateStoreSettings } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';

const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code'),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code'),
});

type BrandingValues = z.infer<typeof brandingSchema>;

export default function BrandingSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();

  const form = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primaryColor: '#6366F1',
      secondaryColor: '#EC4899',
    },
  });

  useEffect(() => {
    if (response?.data) {
      form.reset({
        primaryColor: response.data.primaryColor || '#6366F1',
        secondaryColor: response.data.secondaryColor || '#EC4899',
      });
    }
  }, [response?.data, form]);

  const onSubmit = (data: BrandingValues) => {
    updateSettings.mutate(data);
  };

  const watchPrimary = form.watch('primaryColor');
  const watchSecondary = form.watch('secondaryColor');

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Branding</h3>
        <p className="text-sm text-muted-foreground">
          Customize how your checkout flow and store visuals appear to customers.
        </p>
      </div>
      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">Brand Colors</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <div className="flex gap-2 items-center">
                      <div 
                        className="w-10 h-10 rounded-md border shadow-sm shrink-0" 
                        style={{ backgroundColor: watchPrimary }} 
                      />
                      <FormControl>
                        <Input placeholder="#6366F1" {...field} />
                      </FormControl>
                    </div>
                    <FormDescription>
                      Used for main buttons and primary links.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Color</FormLabel>
                    <div className="flex gap-2 items-center">
                      <div 
                        className="w-10 h-10 rounded-md border shadow-sm shrink-0" 
                        style={{ backgroundColor: watchSecondary }} 
                      />
                      <FormControl>
                        <Input placeholder="#EC4899" {...field} />
                      </FormControl>
                    </div>
                    <FormDescription>
                      Used for highlights and secondary accents.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="text-sm font-semibold text-gray-900">Logo & Assets</h4>
            <div className="p-4 border border-dashed rounded-lg bg-muted/20 text-center">
              <div className="text-sm text-muted-foreground mb-4">
                Media uploads are managed centrally via the Assets Library (Coming Soon). For now, standard text branding will be rendered.
              </div>
              <Button type="button" variant="outline" disabled>Upload Logo</Button>
            </div>
          </div>

          <div className="flex justify-start">
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving...' : 'Save Branding'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
