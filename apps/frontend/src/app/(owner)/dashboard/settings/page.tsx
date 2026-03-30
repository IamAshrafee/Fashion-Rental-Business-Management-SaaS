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
import { useStoreSettings, useUpdateStoreSettings } from './hooks/use-settings';
import { Facebook, Instagram, Music2, Youtube } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const businessInfoSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200),
  tagline: z.string().max(300).optional(),
  about: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  whatsapp: z.string().max(20).optional(),
  facebookUrl: z.union([z.string().url(), z.literal('')]).optional(),
  instagramUrl: z.union([z.string().url(), z.literal('')]).optional(),
  tiktokUrl: z.union([z.string().url(), z.literal('')]).optional(),
  youtubeUrl: z.union([z.string().url(), z.literal('')]).optional(),
});

type BusinessInfoValues = z.infer<typeof businessInfoSchema>;

export default function SettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();

  const settingsData = response?.data;

  const form = useForm<BusinessInfoValues>({
    resolver: zodResolver(businessInfoSchema),
    values: settingsData ? {
      businessName: settingsData.businessName || '',
      tagline: settingsData.tagline || '',
      about: settingsData.about || '',
      phone: settingsData.phone || '',
      email: settingsData.email || '',
      address: settingsData.address || '',
      whatsapp: settingsData.whatsapp || '',
      facebookUrl: settingsData.facebookUrl || '',
      instagramUrl: settingsData.instagramUrl || '',
      tiktokUrl: settingsData.tiktokUrl || '',
      youtubeUrl: settingsData.youtubeUrl || '',
    } : undefined,
    defaultValues: {
      businessName: '',
      tagline: '',
      about: '',
      phone: '',
      email: '',
      address: '',
      whatsapp: '',
      facebookUrl: '',
      instagramUrl: '',
      tiktokUrl: '',
      youtubeUrl: '',
    },
  });

  const onSubmit = (data: BusinessInfoValues) => {
    // Convert empty strings back to empty/undefined to satisfy urls
    updateSettings.mutate(data);
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-6 w-1/4 bg-muted rounded"></div>
      <div className="h-10 w-full bg-muted rounded"></div>
      <div className="h-10 w-full bg-muted rounded"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Business Profile</h3>
        <p className="text-sm text-muted-foreground">
          This is how others will see your store. Keep it professional.
        </p>
      </div>
      <Separator />
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem className="col-span-1">
                  <FormLabel>Store Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="E.g. Couture Closet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tagline"
              render={({ field }) => (
                <FormItem className="col-span-1">
                  <FormLabel>Tagline</FormLabel>
                  <FormControl>
                    <Input placeholder="Premium Wedding Rentals" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+880..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp Support Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+880..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@store.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Physical Address / Showroom</FormLabel>
                <FormControl>
                  <Textarea placeholder="123 Fashion Ave, Dhaka" className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="about"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About Us (Store Description)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Tell your customers about your rental collection..." 
                    className="min-h-[120px]" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  This appears on your storefront&apos;s About page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <h3 className="text-lg font-medium mt-8 mb-4">Social Links</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="facebookUrl"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormLabel className="w-10 flex justify-center text-muted-foreground"><Facebook className="w-5 h-5"/></FormLabel>
                    <div className="flex-1">
                      <FormControl>
                        <Input placeholder="https://facebook.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="instagramUrl"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormLabel className="w-10 flex justify-center text-muted-foreground"><Instagram className="w-5 h-5"/></FormLabel>
                    <div className="flex-1">
                      <FormControl>
                        <Input placeholder="https://instagram.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tiktokUrl"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormLabel className="w-10 flex justify-center text-muted-foreground"><Music2 className="w-5 h-5"/></FormLabel>
                    <div className="flex-1">
                      <FormControl>
                        <Input placeholder="https://tiktok.com/@..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="youtubeUrl"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormLabel className="w-10 flex justify-center text-muted-foreground"><Youtube className="w-5 h-5"/></FormLabel>
                    <div className="flex-1">
                      <FormControl>
                        <Input placeholder="https://youtube.com/c/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
