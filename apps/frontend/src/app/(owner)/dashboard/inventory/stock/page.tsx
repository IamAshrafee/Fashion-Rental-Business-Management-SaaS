'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, PackagePlus, RotateCcw, Search, Settings2 } from 'lucide-react';
import { inventoryApi, type InventorySkuQuery, type InventoryStockState } from '@/lib/api/inventory';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OwnerListEmpty, OwnerListError, OwnerListPagination, OwnerTableSkeleton } from '@/components/owner/workspace';
import { useInventoryStockQuery } from '../hooks/use-inventory-stock-query';

const stateLabel: Record<InventoryStockState, string> = {
  AVAILABLE: 'Available',
  LOW_STOCK: 'Low stock',
  UNAVAILABLE: 'No availability',
  UNCONFIGURED: 'Not stocked',
};

const stateVariant = (state: InventoryStockState): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (state === 'AVAILABLE') return 'default';
  if (state === 'UNAVAILABLE') return 'destructive';
  if (state === 'LOW_STOCK') return 'secondary';
  return 'outline';
};

export default function InventoryStockPage() {
  const { query, update, clear, isNavigating } = useInventoryStockQuery();
  const [search, setSearch] = useState(query.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 350);
  const locations = useQuery({ queryKey: ['inventory-locations'], queryFn: () => inventoryApi.listLocations() });
  const skus = useQuery({
    queryKey: ['inventory-skus', query],
    queryFn: () => inventoryApi.listSkus(query),
    placeholderData: (previous) => previous,
  });

  useEffect(() => setSearch(query.search ?? ''), [query.search]);
  useEffect(() => {
    if (debouncedSearch !== (query.search ?? '')) update({ search: debouncedSearch || null });
  }, [debouncedSearch, query.search, update]);

  const hasFilters = Boolean(query.search || query.locationId || query.stockState || query.sort !== 'PRODUCT' || query.order !== 'asc');

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock by SKU</h1>
          <p className="text-sm text-muted-foreground">One operational row per rentable SKU, calculated from registered physical items.</p>
        </div>
        <Button asChild><Link href="/dashboard/inventory/items/register"><PackagePlus className="mr-2 size-4" />Register physical items</Link></Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(2,minmax(10rem,auto))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, variant, or size" className="pl-9" />
            </div>
            <Select value={query.stockState ?? 'all'} onValueChange={(value) => update({ stockState: value === 'all' ? null : value as InventorySkuQuery['stockState'] })}>
              <SelectTrigger><SelectValue placeholder="All stock states" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All stock states</SelectItem>{Object.entries(stateLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={`${query.sort}-${query.order}`} onValueChange={(value) => { const [sort, order] = value.split('-') as [NonNullable<InventorySkuQuery['sort']>, NonNullable<InventorySkuQuery['order']>]; update({ sort, order }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="PRODUCT-asc">Product A–Z</SelectItem><SelectItem value="ON_HAND-desc">Most on hand</SelectItem><SelectItem value="AVAILABLE-asc">Least available</SelectItem><SelectItem value="RESERVED-desc">Most reserved</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={query.locationId ?? 'all'} onValueChange={(value) => update({ locationId: value === 'all' ? null : value })}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.data?.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
            </Select>
            {hasFilters ? <Button variant="ghost" size="sm" onClick={clear}><RotateCcw className="mr-2 size-4" />Clear filters</Button> : null}
            {(skus.isFetching || isNavigating) ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
          </div>
        </CardContent>
      </Card>

      {skus.isLoading ? <OwnerTableSkeleton columns={8} /> : skus.isError ? (
        <OwnerListError message="Stock could not be loaded." onRetry={() => void skus.refetch()} />
      ) : !skus.data?.data.length ? (
        <OwnerListEmpty title={hasFilters ? 'No SKUs match these filters' : 'No rentable SKUs yet'} description={hasFilters ? 'Clear or adjust the filters to see more stock.' : 'Create a product with at least one variant and size, then configure its inventory.'} icon={<Boxes />} action={hasFilters ? <Button variant="outline" onClick={clear}>Clear filters</Button> : <Button asChild><Link href="/dashboard/products/new">Create product</Link></Button>} />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Product / SKU</TableHead><TableHead>State</TableHead><TableHead className="text-right">Registered</TableHead><TableHead className="text-right">Active</TableHead><TableHead className="text-right">Reserved now</TableHead><TableHead className="text-right">Available now</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>{skus.data.data.map((sku) => <TableRow key={sku.id}>
                  <TableCell><p className="font-medium">{sku.productName}</p><p className="text-xs text-muted-foreground">{sku.variantName || 'Default variant'} · {sku.sizeLabel}</p></TableCell>
                  <TableCell><Badge variant={stateVariant(sku.inventoryState)}>{stateLabel[sku.inventoryState]}</Badge></TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{sku.physicalItemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{sku.activeItemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{sku.reservedQuantity}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{sku.availableQuantity}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" asChild><Link href={`/dashboard/inventory/items/register?variantSizeId=${encodeURIComponent(sku.id)}&productId=${encodeURIComponent(sku.productId)}&returnTo=${encodeURIComponent('/dashboard/inventory/stock')}`}>Add item</Link></Button><Button size="sm" variant="ghost" asChild><Link href={`/dashboard/products/${sku.productId}/inventory`}><Settings2 className="mr-2 size-4" />Manage</Link></Button></div></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
            <div className="grid gap-3 p-3 md:hidden">{skus.data.data.map((sku) => <div key={sku.id} className="space-y-3 rounded-lg border p-4"><div><p className="font-medium">{sku.productName}</p><p className="text-xs text-muted-foreground">{sku.variantName || 'Default variant'} · {sku.sizeLabel}</p></div><Badge variant={stateVariant(sku.inventoryState)}>{stateLabel[sku.inventoryState]}</Badge><div className="grid grid-cols-3 gap-2 text-center text-sm"><div><p className="font-semibold">{sku.physicalItemCount}</p><p className="text-xs text-muted-foreground">Registered</p></div><div><p className="font-semibold">{sku.reservedQuantity}</p><p className="text-xs text-muted-foreground">Reserved</p></div><div><p className="font-semibold">{sku.availableQuantity}</p><p className="text-xs text-muted-foreground">Available</p></div></div><div className="flex gap-2"><Button variant="outline" className="flex-1" asChild><Link href={`/dashboard/inventory/items/register?variantSizeId=${encodeURIComponent(sku.id)}&productId=${encodeURIComponent(sku.productId)}&returnTo=${encodeURIComponent('/dashboard/inventory/stock')}`}>Add item</Link></Button><Button variant="outline" className="flex-1" asChild><Link href={`/dashboard/products/${sku.productId}/inventory`}>Manage</Link></Button></div></div>)}</div>
            <OwnerListPagination page={skus.data.meta.page} totalPages={skus.data.meta.totalPages} total={skus.data.meta.total} pageSize={skus.data.meta.limit} isPending={skus.isFetching || isNavigating} onPageChange={(page) => update({ page }, false)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
