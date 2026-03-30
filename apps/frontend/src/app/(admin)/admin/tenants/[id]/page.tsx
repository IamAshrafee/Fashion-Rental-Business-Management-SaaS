'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { useParams } from 'next/navigation';
import { TenantStatus } from '@closetrent/types';
import { useState } from 'react';
import { ChangePlanDialog } from './components/change-plan-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { setAccessToken, setTenantIdLocal } from '@/lib/auth';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);

  const { data: res, isLoading, error } = useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: () => adminApi.getTenant(id),
  });

  // Point 16: Replace alert() with toast
  const updateStatus = useMutation({
    mutationFn: ({ status, reason }: { status: TenantStatus; reason?: string }) =>
      adminApi.updateTenantStatus(id, status, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      toast({
        title: 'Status updated',
        description: `Tenant status changed to "${variables.status}".`,
      });
    },
    onError: () => {
      toast({
        title: 'Failed to update status',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Point 3: Impersonation uses localStorage token exchange instead of URL query string.
   * Sets the token in memory, sets the tenantId, then opens the dashboard.
   */
  const impersonate = useMutation({
    mutationFn: () => adminApi.impersonateTenant(id),
    onSuccess: (data) => {
      const { impersonationToken, tenantId: tid, subdomain, expiresIn } = data.data;

      // Store impersonation token in localStorage for the target domain to pick up
      const impersonationData = JSON.stringify({
        token: impersonationToken,
        tenantId: tid,
        expiresIn,
        timestamp: Date.now(),
      });
      localStorage.setItem('closetrent_impersonation', impersonationData);

      // Open the tenant dashboard — the owner dashboard will read from localStorage
      window.open(`/dashboard?impersonate=true`, '_blank');

      toast({
        title: 'Impersonation started',
        description: `Viewing as owner of "${data.data.businessName}". Token valid for 1 hour.`,
      });
    },
    onError: () => {
      toast({
        title: 'Impersonation failed',
        description: 'Could not generate impersonation token.',
        variant: 'destructive',
      });
    },
  });

  // Point 19: Delete tenant mutation
  const deleteTenant = useMutation({
    mutationFn: () => adminApi.deleteTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      toast({
        title: 'Tenant deleted',
        description: 'Tenant has been soft-deleted (status set to cancelled).',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to delete tenant',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Point 14: Error state
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Failed to load tenant details</p>
          <p className="text-xs text-destructive/80">
            {error instanceof Error ? error.message : 'Network error — please retry.'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="animate-pulse h-48 rounded-lg bg-muted" />
          <div className="animate-pulse h-48 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  const t = res?.data;
  if (!t) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        Tenant not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={t.businessName}
          description={`Subdomain: ${t.subdomain} | Owner: ${t.owner.fullName}`}
          breadcrumbs={[
            { label: 'Tenants', href: '/admin/tenants' },
            { label: t.businessName }
          ]}
        />
        <div className="flex gap-2">
          {/* Point 15: Confirmation dialogs for destructive actions */}
          {t.status === 'active' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={updateStatus.isPending}
                  className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400 shadow-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 ring-1 ring-inset ring-yellow-600/20"
                >
                  Suspend
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will prevent the tenant from accessing their dashboard and storefront.
                    All active sessions will continue to work until they expire.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => updateStatus.mutate({ status: 'suspended', reason: 'Suspended by admin' })}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Confirm Suspend
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {t.status === 'suspended' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={updateStatus.isPending}
                  className="rounded-md bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400 shadow-sm hover:bg-green-100 dark:hover:bg-green-900/30 ring-1 ring-inset ring-green-600/20"
                >
                  Activate
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Activate Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore the tenant&apos;s access to their dashboard and storefront.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => updateStatus.mutate({ status: 'active' })}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Confirm Activate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Point 15: Impersonation with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={impersonate.isPending}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Impersonate
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Impersonate Tenant Owner?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will receive a 1-hour token that lets you view this tenant&apos;s dashboard as the owner.
                  This action is logged for audit purposes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => impersonate.mutate()}>
                  Start Impersonation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <button
            onClick={() => setIsChangePlanOpen(true)}
            className="rounded-md bg-card px-3 py-2 text-sm font-semibold text-card-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-muted"
          >
            Change Plan
          </button>

          {/* Point 19: Delete tenant with confirmation */}
          {t.status !== 'cancelled' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={deleteTenant.isPending}
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive shadow-sm hover:bg-destructive/20 ring-1 ring-inset ring-destructive/30"
                >
                  Delete
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will set the tenant status to &quot;cancelled&quot; and cancel their subscription.
                    The tenant will lose access to their dashboard and storefront.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteTenant.mutate()}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Points 12/13: Semantic color tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-base font-semibold leading-6 text-card-foreground">Store Profile</h3>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Business Name</dt>
              <dd className="font-medium text-card-foreground">{t.businessName}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Subdomain</dt>
              <dd className="font-medium text-card-foreground">{t.subdomain}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-card-foreground capitalize">{t.status}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Current Plan</dt>
              <dd className="font-medium text-card-foreground">{t.plan?.name || 'No Plan'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-base font-semibold leading-6 text-card-foreground">Owner Contact</h3>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-card-foreground">{t.owner.fullName}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-card-foreground">{t.owner.email || 'N/A'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium text-card-foreground">{t.owner.phone}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold leading-6 text-card-foreground">Usage Data</h3>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div className="rounded border border-dashed border-border p-4 text-center">
            <dt className="text-muted-foreground mb-1">Total Products</dt>
            <dd className="text-2xl font-semibold text-card-foreground">{t._count.products}</dd>
          </div>
          <div className="rounded border border-dashed border-border p-4 text-center">
            <dt className="text-muted-foreground mb-1">Total Bookings</dt>
            <dd className="text-2xl font-semibold text-card-foreground">{t._count.bookings}</dd>
          </div>
          <div className="rounded border border-dashed border-border p-4 text-center">
            <dt className="text-muted-foreground mb-1">Total Customers</dt>
            <dd className="text-2xl font-semibold text-card-foreground">{t._count.customers}</dd>
          </div>
        </dl>
      </div>

      <ChangePlanDialog
        tenantId={id}
        currentPlanId={t.plan?.id}
        open={isChangePlanOpen}
        onOpenChange={setIsChangePlanOpen}
      />
    </div>
  );
}
