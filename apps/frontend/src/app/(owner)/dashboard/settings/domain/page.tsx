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
import { useManageCustomDomain, useStoreSettings } from '../hooks/use-settings';
import { useTenant } from '@/hooks/use-tenant';
import { Separator } from '@/components/ui/separator';
import { Globe, ShieldCheck, ShieldAlert, FileWarning } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const domainSchema = z.object({
  domain: z
    .string()
    .min(3, 'Domain is required')
    .max(255)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format. Example: rentbysara.com'),
});

type DomainValues = z.infer<typeof domainSchema>;

export default function DomainSettingsPage() {
  const { tenant } = useTenant();
  const { data: response, isLoading } = useStoreSettings();
  const { setDomain, verifyDomain, removeDomain } = useManageCustomDomain();

  const form = useForm<DomainValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      domain: '',
    },
  });

  const onSubmit = (data: DomainValues) => {
    setDomain.mutate(data);
  };

  const handleVerify = () => {
    verifyDomain.mutate();
  };

  const handleRemove = () => {
    if (confirm('Are you sure you want to remove your custom domain? Your store will only be available on the ClosetRent subdomain.')) {
      removeDomain.mutate();
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md" />;
  }

  const currentCustomDomain = response?.data?.tenantId ? tenant?.customDomain : null;
  const subdomainUrl = `${tenant?.subdomain}.closetrent.com`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-500" /> Web Domains
        </h3>
        <p className="text-sm text-muted-foreground">
          Manage where your customers go to find your storefront.
        </p>
      </div>
      <Separator />

      <div className="space-y-4">
        <div className="p-4 bg-muted/30 border rounded-lg flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-gray-900">ClosetRent Subdomain</h4>
            <p className="text-xs text-muted-foreground">Always active and secure.</p>
          </div>
          <div className="font-mono text-sm px-3 py-1 bg-white border shadow-sm rounded-md text-gray-700">
            {subdomainUrl}
          </div>
        </div>

        {currentCustomDomain ? (
          <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-lg space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-indigo-900 flex items-center gap-2">
                  {currentCustomDomain}
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </h4>
                <p className="text-sm text-indigo-700/80">Primary custom domain is active.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifyDomain.isPending}>
                  {verifyDomain.isPending ? 'Verifying...' : 'Check Status'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleRemove} disabled={removeDomain.isPending}>
                  Remove
                </Button>
              </div>
            </div>

            <Alert className="bg-white border-indigo-200 shadow-sm">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              <AlertTitle className="text-indigo-900">DNS Setup Instructions</AlertTitle>
              <AlertDescription className="text-indigo-800/80 mt-2 space-y-2">
                <p>Ensure your registrar (Namecheap, GoDaddy, etc.) has the following record:</p>
                <div className="bg-indigo-50 p-2 rounded border border-indigo-100 font-mono text-xs flex justify-between items-center">
                  <span><strong className="mr-2 border-r pr-2 border-indigo-200">Type</strong> CNAME</span>
                  <span><strong className="mr-2 border-r pr-2 border-indigo-200">Name</strong> @ or www</span>
                  <span><strong className="mr-2 border-r pr-2 border-indigo-200">Target</strong> cname.closetrent.com</span>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="pt-4">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Connect a Custom Domain</h4>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Domain Name</FormLabel>
                      <FormControl>
                        <Input placeholder="shop.yourdomain.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Enter the exact domain or subdomain you want to connect.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Alert variant="default" className="bg-amber-50 text-amber-900 border-amber-200">
                  <FileWarning className="h-4 w-4 text-amber-600" />
                  <AlertTitle>Before you save</AlertTitle>
                  <AlertDescription className="text-amber-800">
                    Make sure you add a CNAME record pointing to <strong>cname.closetrent.com</strong> in your DNS provider before adding it here, otherwise verification will fail.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-start">
                  <Button type="submit" disabled={setDomain.isPending}>
                    {setDomain.isPending ? 'Connecting...' : 'Add Domain'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
