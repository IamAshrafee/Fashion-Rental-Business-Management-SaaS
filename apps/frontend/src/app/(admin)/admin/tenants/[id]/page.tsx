'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { useParams, useRouter } from 'next/navigation';
import { TenantStatus } from '@closetrent/types';
import { useState } from 'react';
import { ChangePlanDialog } from './components/change-plan-dialog';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: () => adminApi.getTenant(id),
  });

  const updateStatus = useMutation({
    mutationFn: (status: TenantStatus) => adminApi.updateTenantStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', id] });
    },
  });

  const impersonate = useMutation({
    mutationFn: () => adminApi.impersonateTenant(id),
    onSuccess: (data) => {
      // Setup impersonation strategy.
      // E.g. save token to memory or local storage with a specialized key and open a new window pointing to the owner dashboard.
      const url = new URL(window.location.origin);
      if (res?.data) {
        url.host = `${res.data.subdomain}.${window.location.host.includes(':') ? window.location.host.split(':')[1] ? 'localhost:' + window.location.host.split(':')[1] : 'localhost' : 'closetrent.com'}`;
      }
      url.pathname = '/dashboard';
      url.searchParams.set('impersonate_token', data.data.impersonationToken);
      window.open(url.toString(), '_blank');
    },
  });

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  const t = res?.data;
  if (!t) {
    return <div className="p-8">Tenant not found</div>;
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
          {t.status === 'active' && (
            <button
              onClick={() => updateStatus.mutate('suspended')}
              disabled={updateStatus.isPending}
              className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-700 shadow-sm hover:bg-yellow-100 ring-1 ring-inset ring-yellow-600/20"
            >
              Suspend
            </button>
          )}
          {t.status === 'suspended' && (
            <button
              onClick={() => updateStatus.mutate('active')}
              disabled={updateStatus.isPending}
              className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 shadow-sm hover:bg-green-100 ring-1 ring-inset ring-green-600/20"
            >
              Activate
            </button>
          )}
          <button
            onClick={() => impersonate.mutate()}
            disabled={impersonate.isPending}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Impersonate
          </button>
          <button
            onClick={() => setIsChangePlanOpen(true)}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Change Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Store Profile</h3>
          <dl className="mt-4 divide-y divide-gray-100 text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Business Name</dt>
              <dd className="font-medium text-gray-900">{t.businessName}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Subdomain</dt>
              <dd className="font-medium text-gray-900">{t.subdomain}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-gray-900 capitalize">{t.status}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Current Plan</dt>
              <dd className="font-medium text-gray-900">{t.plan?.name || 'No Plan'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Owner Contact</h3>
          <dl className="mt-4 divide-y divide-gray-100 text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{t.owner.fullName}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{t.owner.email || 'N/A'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-900">{t.owner.phone}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold leading-6 text-gray-900">Usage Data</h3>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div className="rounded border border-dashed p-4 text-center">
            <dt className="text-gray-500 mb-1">Total Products</dt>
            <dd className="text-2xl font-semibold text-gray-900">{t._count.products}</dd>
          </div>
          <div className="rounded border border-dashed p-4 text-center">
            <dt className="text-gray-500 mb-1">Total Bookings</dt>
            <dd className="text-2xl font-semibold text-gray-900">{t._count.bookings}</dd>
          </div>
          <div className="rounded border border-dashed p-4 text-center">
            <dt className="text-gray-500 mb-1">Total Customers</dt>
            <dd className="text-2xl font-semibold text-gray-900">{t._count.customers}</dd>
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
