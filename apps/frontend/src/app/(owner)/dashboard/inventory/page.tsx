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

const formatMoney = (minorUnits: number) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 2,
}).format(minorUnits / 100);

export default function InventoryOverviewPage() {
  const query = useQuery({ queryKey: ['inventory-overview'], queryFn: inventoryApi.overview });
  if (query.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <p>Inventory overview could not be loaded.</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
  const data = query.data;
  const physicalItemTotal = data.physicalItems.reduce((sum, row) => sum + row._count._all, 0);
  const availableUnits = data.physicalItems
    .filter((row) => row.disposition === 'ACTIVE' && row.operationalState === 'AVAILABLE')
    .reduce((sum, row) => sum + row._count._all, 0);
  const activeTransfers =
    (data.transfers.READY ?? 0) +
    (data.transfers.DISPATCHED ?? 0) +
    (data.transfers.PARTIALLY_RECEIVED ?? 0) +
    (data.transfers.RECONCILIATION_REQUIRED ?? 0);

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
            <Link href="/dashboard/inventory/stock">
              <Boxes className="mr-2 h-4 w-4" />
              Stock by SKU
            </Link>
          </Button>
          <Button variant="outline" asChild>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registered physical items</CardDescription>
            <CardTitle className="text-3xl">{physicalItemTotal}</CardTitle>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Acquisition cost</CardDescription>
            <CardTitle>{formatMoney(data.economics.acquisitionCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated current value</CardDescription>
            <CardTitle>{formatMoney(data.economics.estimatedCurrentValue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed service cost</CardDescription>
            <CardTitle>{formatMoney(data.economics.completedServiceCost)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {data.economics.completedServiceOrders} completed service orders
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
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/inventory/locations">Manage locations</Link>
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
              ['Return / periodic inspections', data.workQueues.draftInspections, PackageCheck, '/dashboard/inventory/inspections?kind=INSPECTION&status=DRAFT'],
              ['Cleaning and service work', data.workQueues.openServiceOrders, Wrench, '/dashboard/inventory/service'],
              ['Open condition issues', data.workQueues.openIssues, AlertTriangle, '/dashboard/inventory/inspections?kind=ISSUE&status=OPEN'],
              ['Overdue fulfillment items', data.workQueues.overdueRequirements, AlertTriangle, '/dashboard/bookings?queue=OVERDUE'],
              ['Overdue inventory transfers', data.workQueues.overdueTransfers, ArrowLeftRight, '/dashboard/inventory/transfers?attention=overdue'],
            ].map(([label, count, Icon, href]) => {
              const QueueIcon = Icon as typeof Wrench;
              return (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2">
                    <QueueIcon className="h-4 w-4 text-muted-foreground" />
                    {String(label)}
                  </span>
                  <Badge variant={Number(count) ? 'destructive' : 'secondary'}>
                    {Number(count)}
                  </Badge>
                </Link>
              );
            })}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/inventory/inspections">Open inventory attention</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
