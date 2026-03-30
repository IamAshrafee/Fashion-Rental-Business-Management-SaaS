'use client';

import React, { useRef, useState } from 'react';
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
import { useStoreSettings, useUpdateStoreSettings, useUploadLogo } from '../hooks/use-settings';
import { Separator } from '@/components/ui/separator';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';

const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code'),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code'),
});

type BrandingValues = z.infer<typeof brandingSchema>;

export default function BrandingSettingsPage() {
  const { data: response, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const uploadLogo = useUploadLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const settingsData = response?.data;

  const form = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    values: settingsData ? {
      primaryColor: settingsData.primaryColor || '#6366F1',
      secondaryColor: settingsData.secondaryColor || '#EC4899',
    } : undefined,
    defaultValues: {
      primaryColor: '#6366F1',
      secondaryColor: '#EC4899',
    },
  });

  const onSubmit = (data: BrandingValues) => {
    updateSettings.mutate(data);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    uploadLogo.mutate(file, {
      onSuccess: () => {
        setPreviewUrl(null);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: () => {
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  const watchPrimary = form.watch('primaryColor');
  const watchSecondary = form.watch('secondaryColor');

  // Determine current logo to display
  const currentLogo = previewUrl || settingsData?.logoUrl;

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
            <h4 className="text-sm font-semibold text-foreground">Brand Colors</h4>
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
            <h4 className="text-sm font-semibold text-foreground">Logo & Assets</h4>
            <div className="p-6 border rounded-lg bg-muted/10">
              <div className="flex items-start gap-6">
                {/* Logo preview */}
                <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-background shrink-0 overflow-hidden">
                  {currentLogo ? (
                    <Image
                      src={currentLogo}
                      alt="Store logo"
                      width={96}
                      height={96}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                  )}
                </div>

                {/* Upload controls */}
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Store Logo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recommended: 400×400px, PNG or WebP with transparent background.
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadLogo.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadLogo.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {currentLogo ? 'Change Logo' : 'Upload Logo'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
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
