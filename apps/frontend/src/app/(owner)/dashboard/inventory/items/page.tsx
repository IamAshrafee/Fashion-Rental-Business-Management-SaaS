'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, PackagePlus, RotateCcw, Search } from 'lucide-react';
import { inventoryApi, type InventoryItemsQuery } from '@/lib/api/inventory';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  OwnerListEmpty,
  OwnerListError,
  OwnerListPagination,
  OwnerTableSkeleton,
} from '@/components/owner/workspace';
import { useInventoryItemsQuery } from '../hooks/use-inventory-items-query';

const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'] as const;
const dispositions = ['ACTIVE', 'QUARANTINED', 'LOST', 'RETIRED'] as const;
const operationalStates = [
  'AVAILABLE',
  'PREPARING',
  'READY',
  'OUT_FOR_RENTAL',
  'AWAITING_INSPECTION',
  'CLEANING',
  'WASHING',
  'REPAIRING',
  'IN_TRANSFER',
] as const;

export default function InventoryItemsPage() {
  const { query, update, clear, isNavigating } = useInventoryItemsQuery();
  const [search, setSearch] = useState(query.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 350);
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });
  const skus = useQuery({
    queryKey: ['inventory-skus', 'item-filters'],
    queryFn: () => inventoryApi.listSkus({ page: 1, limit: 100, sort: 'PRODUCT', order: 'asc' }),
  });
  const items = useQuery({
    queryKey: ['inventory-items', query],
    queryFn: () => inventoryApi.listItems(query),
    placeholderData: (previous) => previous,
  });
  useEffect(() => setSearch(query.search ?? ''), [query.search]);
  useEffect(() => {
    if (debouncedSearch !== (query.search ?? '')) update({ search: debouncedSearch || null });
  }, [debouncedSearch, query.search, update]);
  const products = [
    ...new Map(
      (skus.data?.data || []).map((sku) => [
        sku.productId,
        { id: sku.productId, name: sku.productName },
      ]),
    ).values(),
  ];
  const hasFilters = Boolean(
    query.search ||
    query.locationId ||
    query.disposition ||
    query.operationalState ||
    query.condition ||
    query.productId ||
    query.variantSizeId ||
    query.attention ||
    query.availableFrom ||
    query.availableTo,
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Physical items</h1>
          <p className="text-sm text-muted-foreground">
            Identify, locate, inspect, service, and track every individual rental piece.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/inventory/items/register">
            <PackagePlus className="mr-2 size-4" />
            Register physical items
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(10rem,auto))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Asset code, barcode, or product"
                className="pl-9"
              />
            </div>
            <Select
              value={query.locationId ?? 'all'}
              onValueChange={(value) => update({ locationId: value === 'all' ? null : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.data?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={query.operationalState ?? 'all'}
              onValueChange={(value) =>
                update({
                  operationalState:
                    value === 'all' ? null : (value as InventoryItemsQuery['operationalState']),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All operational states</SelectItem>
                {operationalStates.map((value) => (
                  <SelectItem key={value} value={value}>
                    {humanize(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={query.condition ?? 'all'}
              onValueChange={(value) =>
                update({
                  condition: value === 'all' ? null : (value as InventoryItemsQuery['condition']),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All conditions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conditions</SelectItem>
                {conditions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {humanize(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={query.disposition ?? 'all'}
              onValueChange={(value) =>
                update({
                  disposition:
                    value === 'all' ? null : (value as InventoryItemsQuery['disposition']),
                })
              }
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="All dispositions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dispositions</SelectItem>
                {dispositions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {humanize(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clear}>
                <RotateCcw className="mr-2 size-4" />
                Clear filters
              </Button>
            ) : null}
            {items.isFetching || isNavigating ? (
              <span className="text-xs text-muted-foreground">Updating…</span>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={query.productId ?? 'all'}
              onValueChange={(value) =>
                update({
                  productId: value === 'all' ? null : value,
                  variantSizeId: null,
                  ...(value === 'all' ? { availableFrom: null, availableTo: null } : {}),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={query.variantSizeId ?? 'all'}
              onValueChange={(value) => update({ variantSizeId: value === 'all' ? null : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All SKUs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SKUs</SelectItem>
                {skus.data?.data
                  .filter((sku) => !query.productId || sku.productId === query.productId)
                  .map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.productName} · {sku.variantName || 'Default'} · {sku.sizeLabel}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={query.attention ?? 'all'}
              onValueChange={(value) =>
                update({
                  attention: value === 'all' ? null : (value as InventoryItemsQuery['attention']),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any attention" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any attention state</SelectItem>
                <SelectItem value="OPEN_ISSUE">Open issue</SelectItem>
                <SelectItem value="OPEN_SERVICE">Open service work</SelectItem>
                <SelectItem value="INCOMPLETE_SET">Missing / damaged component</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="grid grid-cols-2 gap-2"
              title={
                !query.productId && !query.variantSizeId
                  ? 'Choose a product or SKU before checking rental dates'
                  : 'Authoritative availability including policy buffers'
              }
            >
              <Input
                disabled={!query.productId && !query.variantSizeId}
                aria-label="Available for rental from"
                type="date"
                value={query.availableFrom || ''}
                onChange={(event) =>
                  update({
                    availableFrom: event.target.value || null,
                    availableTo: event.target.value
                      ? query.availableTo || event.target.value
                      : null,
                  })
                }
              />
              <Input
                disabled={!query.productId && !query.variantSizeId}
                aria-label="Available for rental through"
                type="date"
                min={query.availableFrom}
                value={query.availableTo || ''}
                onChange={(event) =>
                  update({
                    availableTo: event.target.value || null,
                    availableFrom: event.target.value
                      ? query.availableFrom || event.target.value
                      : null,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {items.isLoading ? (
        <OwnerTableSkeleton columns={8} />
      ) : items.isError ? (
        <OwnerListError
          message="Physical items could not be loaded."
          onRetry={() => void items.refetch()}
        />
      ) : !items.data?.data.length ? (
        <OwnerListEmpty
          title={hasFilters ? 'No items match these filters' : 'No physical items registered'}
          description={
            hasFilters
              ? 'Clear or adjust the filters to find other items.'
              : 'Register the first rental piece and give it a permanent asset code.'
          }
          icon={<ClipboardList />}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/inventory/items/register">Register physical items</Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Product / SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Operational state</TableHead>
                    <TableHead>Rental activity</TableHead>
                    <TableHead>Open work</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.data.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-mono text-sm font-medium">{item.assetCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.barcode || 'No barcode'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{item.variantSize.variant.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.variantSize.variant.variantName || 'Default variant'} ·{' '}
                          {item.variantSize.sizeInstance.displayLabel}
                        </p>
                      </TableCell>
                      <TableCell>{item.location.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.condition === 'DAMAGED' ? 'destructive' : 'outline'}>
                          {humanize(item.condition)}
                        </Badge>
                        {!item.componentComplete && (
                          <p className="mt-1 text-xs text-destructive">Set incomplete</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              item.operationalState === 'AVAILABLE' && item.disposition === 'ACTIVE'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {humanize(item.operationalState)}
                          </Badge>
                          {item.disposition !== 'ACTIVE' ? (
                            <p className="text-xs text-muted-foreground">
                              {humanize(item.disposition)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>
                          {item.rentalMetrics?.completedRentals ?? 0} completed ·{' '}
                          {item.rentalMetrics?.totalRentalDays ?? 0} days
                        </p>
                        <p className="text-muted-foreground">
                          {item.nextRental
                            ? `Next ${item.nextRental.reservation.booking.bookingNumber} · ${item.nextRental.blockedStartDate.slice(0, 10)}`
                            : item.lastRental
                              ? `Last ${item.lastRental.reservation.booking.bookingNumber} · ${item.lastRental.blockedEndDate.slice(0, 10)}`
                              : 'No rental activity'}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item._count.issues} issues · {item._count.serviceOrders} service
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`/dashboard/products/${item.variantSize.variant.product.id}/inventory/${item.id}`}
                          >
                            Manage
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 p-3 md:hidden">
              {items.data.data.map((item) => (
                <div key={item.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono font-medium">{item.assetCode}</p>
                      <p className="text-sm">{item.variantSize.variant.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.variantSize.variant.variantName || 'Default variant'} ·{' '}
                        {item.variantSize.sizeInstance.displayLabel}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.operationalState === 'AVAILABLE' && item.disposition === 'ACTIVE'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {humanize(item.operationalState)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.location.name} · {humanize(item.condition)}
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link
                      href={`/dashboard/products/${item.variantSize.variant.product.id}/inventory/${item.id}`}
                    >
                      Manage item
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
            <OwnerListPagination
              page={items.data.meta.page}
              totalPages={items.data.meta.totalPages}
              total={items.data.meta.total}
              pageSize={items.data.meta.limit}
              isPending={items.isFetching || isNavigating}
              onPageChange={(page) => update({ page }, false)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
