'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { inventoryOperationsApi, type InventoryServiceOrderStatus, type InventoryServiceOrderType } from '@/lib/api/inventory-operations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OwnerListEmpty, OwnerListError, OwnerListPagination, OwnerTableSkeleton } from '@/components/owner/workspace';

const statuses: InventoryServiceOrderStatus[] = ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'];
const types: InventoryServiceOrderType[] = ['PREPARATION', 'CLEANING', 'WASHING', 'REPAIR', 'ALTERATION', 'MAINTENANCE'];
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export default function InventoryServicePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const value = (key: string) => params.get(key) ?? '';
  const status = value('status');
  const serviceType = value('serviceType');
  const locationId = value('locationId');
  const overdue = value('overdue');
  const productId = value('productId');
  const variantSizeId = value('variantSizeId');
  const stockUnitId = value('stockUnitId');
  const provider = value('provider');
  const dueBefore = value('dueBefore');
  const issueId = value('issueId');
  const locations = useQuery({ queryKey: ['inventory-locations'], queryFn: () => inventoryApi.listLocations(true) });
  const skus = useQuery({ queryKey: ['inventory-skus', 'service-filter'], queryFn: () => inventoryApi.listSkus({ page: 1, limit: 100 }) });
  const items = useQuery({ queryKey: ['inventory-items', 'service-filter'], queryFn: () => inventoryApi.listItems({ page: 1, limit: 100 }) });
  const products = [...new Map((skus.data?.data || []).map((sku) => [sku.productId, { id: sku.productId, name: sku.productName }])).values()];
  const queue = useQuery({
    queryKey: ['inventory-service-queue', page, status, serviceType, locationId, overdue, productId, variantSizeId, stockUnitId, provider, dueBefore, issueId],
    queryFn: () => inventoryOperationsApi.listServiceQueue({
      page, limit: 25,
      ...(status ? { status: status as InventoryServiceOrderStatus } : {}),
      ...(serviceType ? { serviceType: serviceType as InventoryServiceOrderType } : {}),
      ...(locationId ? { locationId } : {}), ...(overdue ? { overdue: overdue as 'true' | 'false' } : {}),
      ...(productId ? { productId } : {}), ...(variantSizeId ? { variantSizeId } : {}),
      ...(stockUnitId ? { stockUnitId } : {}), ...(provider ? { provider } : {}),
      ...(dueBefore ? { dueBefore } : {}), ...(issueId ? { issueId } : {}),
    }),
    placeholderData: (previous) => previous,
  });
  const update = (changes: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, nextValue] of Object.entries(changes)) {
      if (nextValue) next.set(key, nextValue);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    const href = `${pathname}${next.size ? `?${next}` : ''}`;
    if (push) router.push(href);
    else router.replace(href);
  };

  return <div className="space-y-6 pb-10">
    <div><h1 className="text-2xl font-semibold tracking-tight">Service work</h1><p className="text-sm text-muted-foreground">Preparation, cleaning, washing, repair, alteration, maintenance, provider, cost, and due-state control.</p></div>
    <Card><CardContent className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect value={status} allLabel="All statuses" options={statuses} onChange={(next) => update({ status: next || null })} />
        <FilterSelect value={serviceType} allLabel="All work types" options={types} onChange={(next) => update({ serviceType: next || null })} />
        <FilterSelect value={locationId} allLabel="All service locations" options={(locations.data || []).map((location) => ({ value: location.id, label: location.name }))} onChange={(next) => update({ locationId: next || null })} />
        <FilterSelect value={overdue} allLabel="Any due state" options={[{ value: 'true', label: 'Overdue only' }, { value: 'false', label: 'Not overdue' }]} onChange={(next) => update({ overdue: next || null })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect value={productId} allLabel="All products" options={products.map((product) => ({ value: product.id, label: product.name }))} onChange={(next) => update({ productId: next || null, variantSizeId: null, stockUnitId: null })} />
        <FilterSelect value={variantSizeId} allLabel="All SKUs" options={(skus.data?.data || []).filter((sku) => !productId || sku.productId === productId).map((sku) => ({ value: sku.id, label: `${sku.productName} · ${sku.variantName || 'Default'} · ${sku.sizeLabel}` }))} onChange={(next) => update({ variantSizeId: next || null, stockUnitId: null })} />
        <FilterSelect value={stockUnitId} allLabel="All physical items" options={(items.data?.data || []).filter((item) => (!productId || item.variantSize.variant.product.id === productId) && (!variantSizeId || item.variantSize.id === variantSizeId)).map((item) => ({ value: item.id, label: `${item.assetCode} · ${item.variantSize.variant.product.name}` }))} onChange={(next) => update({ stockUnitId: next || null })} />
        <Input type="date" aria-label="Due before" value={dueBefore} onChange={(event) => update({ dueBefore: event.target.value || null })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><Input key={`provider-${provider}`} defaultValue={provider} placeholder="Provider name contains…" onBlur={(event) => update({ provider: event.target.value.trim() || null })} /><Input key={`issue-${issueId}`} defaultValue={issueId} placeholder="Issue ID (from an issue link)" onBlur={(event) => update({ issueId: event.target.value.trim() || null })} /></div>
    </CardContent></Card>
    {queue.isLoading ? <OwnerTableSkeleton columns={6} /> : queue.isError ? <OwnerListError message="Service work could not be loaded." onRetry={() => void queue.refetch()} /> : !queue.data?.data.length ? <OwnerListEmpty title="No service work matches" description="Change filters or create service work from a physical item." icon={<Wrench />} /> : <Card className="overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Physical item</TableHead><TableHead>Work</TableHead><TableHead>Status</TableHead><TableHead>Due / provider</TableHead><TableHead>Cost</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{queue.data.data.map((order) => { const unit = order.stockUnit; return <TableRow key={order.id}><TableCell><p className="font-medium">{unit.variantSize.variant.product.name}</p><p className="text-xs text-muted-foreground">{unit.assetCode} · {unit.location.name}</p></TableCell><TableCell>{humanize(order.serviceType)}</TableCell><TableCell><Badge variant={order.overdue ? 'destructive' : 'outline'}>{order.overdue ? 'Overdue' : humanize(order.status)}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{order.expectedCompletionAt ? new Date(order.expectedCompletionAt).toLocaleString() : 'No due time'}{order.providerName ? ` · ${order.providerName}` : ''}</TableCell><TableCell className="text-xs">{order.cost === null ? 'Not recorded' : new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(order.cost / 100)}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" asChild><Link href={`/dashboard/products/${unit.variantSize.variant.product.id}/inventory/${unit.id}`}>Manage work</Link></Button></TableCell></TableRow>; })}</TableBody></Table></div><OwnerListPagination page={queue.data.meta.page} totalPages={queue.data.meta.totalPages} total={queue.data.meta.total} pageSize={queue.data.meta.limit} isPending={queue.isFetching} onPageChange={(nextPage) => update({ page: String(nextPage) }, true)} /></CardContent></Card>}
  </div>;
}

function FilterSelect({ value, allLabel, options, onChange }: { value: string; allLabel: string; options: readonly string[] | Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const normalized = options.map((option) => typeof option === 'string' ? { value: option, label: humanize(option) } : option);
  return <Select value={value || 'all'} onValueChange={(next) => onChange(next === 'all' ? '' : next)}><SelectTrigger><SelectValue placeholder={allLabel} /></SelectTrigger><SelectContent><SelectItem value="all">{allLabel}</SelectItem>{normalized.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
