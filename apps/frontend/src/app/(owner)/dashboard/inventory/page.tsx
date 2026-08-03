'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  Loader2,
  MapPin,
  PackageCheck,
  Wrench,
} from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());

export default function InventoryOverviewPage() {
  const query = useQuery({ queryKey: ['inventory-overview'], queryFn: inventoryApi.overview });
  if (query.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!query.data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Inventory overview could not be loaded.
        </CardContent>
      </Card>
    );
  }
  const data = query.data;
  const serializedTotal = data.serialized.reduce((sum, row) => sum + row._count._all, 0);
  const availableUnits = data.serialized
    .filter((row) => row.disposition === 'ACTIVE' && row.operationalState === 'AVAILABLE')
    .reduce((sum, row) => sum + row._count._all, 0);
  const activeTransfers =
    (data.transfers.READY ?? 0) +
    (data.transfers.DISPATCHED ?? 0) +
    (data.transfers.PARTIALLY_RECEIVED ?? 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory control</h1>
          <p className="text-sm text-muted-foreground">
            Stock identity, availability, movement, and item-care work in one operational workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/inventory/items">
              <Boxes className="mr-2 h-4 w-4" />
              Physical items
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/inventory/transfers">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transfers
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pooled pieces on hand</CardDescription>
            <CardTitle className="text-3xl">{data.pooled.onHandQuantity}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across {data.pooled.poolCount} location pools
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Serialized pieces</CardDescription>
            <CardTitle className="text-3xl">{serializedTotal}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {availableUnits} operationally available now
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Future inventory demand</CardDescription>
            <CardTitle className="text-3xl">{data.reservations.quantity}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across {data.reservations.reservationCount} active reservations
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transfers in progress</CardDescription>
            <CardTitle className="text-3xl">{activeTransfers}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {data.transfers.RECONCILIATION_REQUIRED ?? 0} require reconciliation
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Inventory locations
            </CardTitle>
            <CardDescription>Where stock is held and fulfilled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data.locations.length ? (
              <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                No location exists. Stock cannot be registered or reserved until one is configured.
              </div>
            ) : (
              data.locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {location.name}{' '}
                      {location.isDefault && (
                        <Badge className="ml-2" variant="secondary">
                          Default
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {location.code} · {humanize(location.locationType)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{location._count.stockUnits} physical items</p>
                    <p>{location._count.pools} pooled SKUs</p>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/inventory/locations">Manage locations and policies</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Work queues
            </CardTitle>
            <CardDescription>Inventory work requiring staff action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ['Return / periodic inspections', data.workQueues.draftInspections, PackageCheck],
              ['Cleaning and service work', data.workQueues.openServiceOrders, Wrench],
              ['Open condition issues', data.workQueues.openIssues, AlertTriangle],
              ['Overdue fulfillment items', data.workQueues.overdueRequirements, AlertTriangle],
            ].map(([label, count, Icon]) => {
              const QueueIcon = Icon as typeof Wrench;
              return (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <QueueIcon className="h-4 w-4 text-muted-foreground" />
                    {String(label)}
                  </span>
                  <Badge variant={Number(count) ? 'destructive' : 'secondary'}>
                    {Number(count)}
                  </Badge>
                </div>
              );
            })}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/operations">Open operations workspace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {!!data.lowStock.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low pooled stock</CardTitle>
            <CardDescription>
              On-hand quantity has reached the configured reorder threshold.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {data.lowStock.map((pool) => (
              <div
                key={pool.id}
                className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{pool.variantSize.variant.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pool.variantSize.variant.variantName || 'Default variant'} ·{' '}
                    {pool.variantSize.sizeInstance.displayLabel} · {pool.location.name}
                  </p>
                </div>
                <Badge variant="outline">
                  {pool.onHandQuantity} / {pool.reorderThreshold}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
