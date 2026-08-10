'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardCheck, History, RotateCcw, Search } from 'lucide-react';
import {
  inventoryApi,
  type InventoryMovementQuery,
  type InventoryMovementRecord,
} from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OwnerListEmpty, OwnerListError, OwnerListPagination, OwnerTableSkeleton } from '@/components/owner/workspace';

const movementTypes = [
  'INITIAL_STOCK',
  'POOLED_ADDITION',
  'POOLED_REDUCTION',
  'UNIT_REGISTERED',
  'CONDITION_CHANGED',
  'VALUATION_CHANGED',
  'MAINTENANCE_STARTED',
  'MAINTENANCE_ENDED',
  'UNIT_RETIRED',
  'UNIT_LOST',
  'UNIT_RECOVERED',
  'ADMIN_CORRECTION',
  'TRANSFER_RESERVED',
  'TRANSFER_DISPATCHED',
  'TRANSFER_RECEIVED',
  'TRANSFER_CANCELLED',
  'COUNT_CORRECTION',
  'DAMAGE_WRITE_OFF',
] as const;

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

function localBoundary(date: string, end = false): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T${end ? '23:59:59.999' : '00:00:00.000'}`).toISOString();
}

function numberFromState(state: Record<string, unknown> | null, key: string): number | null {
  const value = state?.[key];
  return typeof value === 'number' ? value : null;
}

function sourceLink(movement: InventoryMovementRecord) {
  if (movement.reservation?.booking) {
    return { href: `/dashboard/bookings/${movement.reservation.booking.id}`, label: movement.reservation.booking.bookingNumber };
  }
  if (movement.transfer) {
    return { href: `/dashboard/inventory/transfers?transferId=${movement.transfer.id}`, label: movement.transfer.transferNumber };
  }
  if (movement.stockUnit) {
    return { href: `/dashboard/products/${movement.variantSize?.variant.product.id}/inventory/${movement.stockUnit.id}`, label: movement.stockUnit.assetCode };
  }
  if (movement.variantSize) {
    return { href: `/dashboard/products/${movement.variantSize.variant.product.id}/inventory`, label: movement.variantSize.variant.product.name };
  }
  return null;
}

function LedgerRow({ movement, counts }: { movement: InventoryMovementRecord; counts: boolean }) {
  const source = sourceLink(movement);
  const expected = numberFromState(movement.beforeState, 'expectedQuantity');
  const observed = numberFromState(movement.afterState, 'observedQuantity');
  const variance = numberFromState(movement.afterState, 'variance');
  const location = movement.inventoryPool?.location
    ?? movement.destinationLocation
    ?? movement.originLocation;
  const itemLabel = movement.variantSize
    ? `${movement.variantSize.variant.product.name} · ${movement.variantSize.variant.variantName || 'Default'} · ${movement.variantSize.sizeInstance.displayLabel}`
    : movement.stockUnit?.assetCode ?? 'Historical inventory reference';

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{itemLabel}</p>
        <p className="text-xs text-muted-foreground">{location?.name ?? 'No location'} · {new Date(movement.createdAt).toLocaleString()}</p>
      </TableCell>
      <TableCell><Badge variant="outline">{humanize(movement.movementType)}</Badge></TableCell>
      {counts ? (
        <TableCell className="tabular-nums">{expected ?? '—'} → {observed ?? '—'} <span className={variance && variance < 0 ? 'text-destructive' : 'text-muted-foreground'}>({variance !== null && variance >= 0 ? '+' : ''}{variance ?? '—'})</span></TableCell>
      ) : (
        <TableCell className="font-medium tabular-nums">{movement.quantityDelta !== null && movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta ?? '—'}</TableCell>
      )}
      <TableCell><p className="max-w-xs truncate text-sm">{movement.reason}</p><p className="text-xs text-muted-foreground">{movement.actor?.fullName ?? 'System'}</p></TableCell>
      <TableCell className="text-right">
        {source ? <Button variant="ghost" size="sm" asChild><Link href={source.href}>{source.label}<ArrowRight className="ml-2 h-3 w-3" /></Link></Button> : '—'}
      </TableCell>
    </TableRow>
  );
}

export function InventoryLedgerTable({ mode }: { mode: 'movements' | 'counts' }) {
  const counts = mode === 'counts';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const movementType = searchParams.get('movementType') ?? '';
  const locationId = searchParams.get('locationId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const locations = useQuery({ queryKey: ['inventory-locations'], queryFn: () => inventoryApi.listLocations(true) });

  const query: InventoryMovementQuery = {
    page,
    limit: 25,
    ...(movementType ? { movementType } : {}),
    ...(locationId ? { locationId } : {}),
    ...(dateFrom ? { dateFrom: localBoundary(dateFrom) } : {}),
    ...(dateTo ? { dateTo: localBoundary(dateTo, true) } : {}),
    ...(searchParams.get('search') ? { search: searchParams.get('search')! } : {}),
  };
  const ledger = useQuery({
    queryKey: ['inventory-ledger', mode, query],
    queryFn: () => counts ? inventoryApi.listCounts(query) : inventoryApi.listMovements(query),
    placeholderData: (previous) => previous,
  });

  const update = (changes: Record<string, string | null>, replace = true) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    const href = `${pathname}${next.size ? `?${next.toString()}` : ''}`;
    if (replace) router.replace(href);
    else router.push(href);
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    update({ search: search.trim() || null });
  };
  const hasFilters = Boolean(searchParams.get('search') || movementType || locationId || dateFrom || dateTo);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{counts ? 'Stock counts' : 'Inventory movements'}</h1>
        <p className="text-sm text-muted-foreground">{counts ? 'Immutable physical-count reconciliation records with expected, observed, and variance quantities.' : 'The immutable ledger of pooled and serialized inventory effects.'}</p>
      </div>
      <Card><CardContent className="space-y-3 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_repeat(4,minmax(10rem,auto))]">
          <form className="relative" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, asset code, or reason" />
          </form>
          {!counts ? <Select value={movementType || 'all'} onValueChange={(value) => update({ movementType: value === 'all' ? null : value })}><SelectTrigger><SelectValue placeholder="All movement types" /></SelectTrigger><SelectContent><SelectItem value="all">All movement types</SelectItem>{movementTypes.map((value) => <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>)}</SelectContent></Select> : null}
          <Select value={locationId || 'all'} onValueChange={(value) => update({ locationId: value === 'all' ? null : value })}><SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger><SelectContent><SelectItem value="all">All locations</SelectItem>{locations.data?.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select>
          <Input aria-label="From date" type="date" value={dateFrom} onChange={(event) => update({ dateFrom: event.target.value || null })} />
          <Input aria-label="To date" type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => update({ dateTo: event.target.value || null })} />
        </div>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={() => { setSearch(''); router.replace(pathname); }}><RotateCcw className="mr-2 h-4 w-4" />Clear filters</Button> : null}
      </CardContent></Card>

      {ledger.isLoading ? <OwnerTableSkeleton columns={5} /> : ledger.isError ? <OwnerListError message={`${counts ? 'Stock counts' : 'Inventory movements'} could not be loaded.`} onRetry={() => void ledger.refetch()} /> : !ledger.data?.data.length ? <OwnerListEmpty title={hasFilters ? 'No records match these filters' : `No ${counts ? 'stock counts' : 'inventory movements'} yet`} description={hasFilters ? 'Clear or adjust the filters.' : counts ? 'Counts appear here after staff reconcile pooled stock.' : 'Inventory effects appear here when stock is registered, adjusted, transferred, serviced, or retired.'} icon={counts ? <ClipboardCheck /> : <History />} /> : <Card className="overflow-hidden"><CardContent className="p-0"><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Inventory</TableHead><TableHead>Type</TableHead><TableHead>{counts ? 'Expected → observed (variance)' : 'Effect'}</TableHead><TableHead>Reason / actor</TableHead><TableHead className="text-right">Source</TableHead></TableRow></TableHeader><TableBody>{ledger.data.data.map((movement) => <LedgerRow key={movement.id} movement={movement} counts={counts} />)}</TableBody></Table></div><div className="grid gap-3 p-3 md:hidden">{ledger.data.data.map((movement) => { const source = sourceLink(movement); return <div key={movement.id} className="space-y-2 rounded-lg border p-4"><div className="flex items-start justify-between gap-2"><p className="font-medium">{movement.variantSize?.variant.product.name ?? movement.stockUnit?.assetCode ?? 'Inventory record'}</p><Badge variant="outline">{humanize(movement.movementType)}</Badge></div><p className="text-sm">{movement.reason}</p><p className="text-xs text-muted-foreground">{movement.quantityDelta !== null ? `Effect ${movement.quantityDelta >= 0 ? '+' : ''}${movement.quantityDelta} · ` : ''}{new Date(movement.createdAt).toLocaleString()} · {movement.actor?.fullName ?? 'System'}</p>{source ? <Button variant="outline" size="sm" asChild><Link href={source.href}>Open {source.label}</Link></Button> : null}</div>; })}</div><OwnerListPagination page={ledger.data.meta.page} totalPages={ledger.data.meta.totalPages} total={ledger.data.meta.total} pageSize={ledger.data.meta.limit} isPending={ledger.isFetching} onPageChange={(nextPage) => update({ page: String(nextPage) }, false)} /></CardContent></Card>}
    </div>
  );
}
