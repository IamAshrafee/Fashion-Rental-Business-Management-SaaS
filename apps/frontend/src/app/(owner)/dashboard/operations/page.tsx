'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, Loader2, Wrench } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());

export default function OperationsPage() {
  const query = useQuery({
    queryKey: ['inventory-operations-queue'],
    queryFn: inventoryApi.operations,
  });
  if (query.isLoading)
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  if (!query.data)
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Operations queue could not be loaded.
        </CardContent>
      </Card>
    );
  const data = query.data;
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory operations</h1>
        <p className="text-sm text-muted-foreground">
          Inspection, issue, cleaning, washing, repair, alteration, and maintenance work.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Awaiting inspection <Badge variant="secondary">{data.inspections.length}</Badge>
            </CardTitle>
            <CardDescription>Draft inspections that staff must complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data.inspections.length ? (
              <p className="text-sm text-muted-foreground">No inspections waiting.</p>
            ) : (
              data.inspections.map((inspection) => (
                <div key={inspection.id} className="rounded-md border p-3">
                  <p className="font-medium">
                    {inspection.stockUnit.variantSize.variant.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inspection.stockUnit.assetCode} · {humanize(inspection.inspectionType)}
                  </p>
                  <Button className="mt-2" size="sm" variant="outline" asChild>
                    <Link
                      href={`/dashboard/products/${inspection.stockUnit.variantSize.variant.product.id}/inventory/${inspection.stockUnit.id}`}
                    >
                      Complete inspection
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Service work <Badge variant="secondary">{data.serviceOrders.length}</Badge>
            </CardTitle>
            <CardDescription>Preparation and item-care jobs in progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data.serviceOrders.length ? (
              <p className="text-sm text-muted-foreground">No open service work.</p>
            ) : (
              data.serviceOrders.map((order) => (
                <div key={order.id} className="rounded-md border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">
                      {order.stockUnit.variantSize.variant.product.name}
                    </p>
                    <Badge variant="outline">{humanize(order.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.stockUnit.assetCode} · {humanize(order.serviceType)} ·{' '}
                    {order.serviceLocation.name}
                  </p>
                  <Button className="mt-2" size="sm" variant="outline" asChild>
                    <Link
                      href={`/dashboard/products/${order.stockUnit.variantSize.variant.product.id}/inventory/${order.stockUnit.id}`}
                    >
                      Manage work
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Condition issues{' '}
              <Badge variant={data.issues.length ? 'destructive' : 'secondary'}>
                {data.issues.length}
              </Badge>
            </CardTitle>
            <CardDescription>Unresolved damage, missing parts, stains, or faults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data.issues.length ? (
              <p className="text-sm text-muted-foreground">No unresolved issues.</p>
            ) : (
              data.issues.map((issue) => (
                <div key={issue.id} className="rounded-md border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">
                      {issue.stockUnit.variantSize.variant.product.name}
                    </p>
                    <Badge
                      variant={
                        ['SEVERE', 'CRITICAL'].includes(issue.severity) ? 'destructive' : 'outline'
                      }
                    >
                      {humanize(issue.severity)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {issue.stockUnit.assetCode} · {humanize(issue.issueType)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs">{issue.description}</p>
                  <Button className="mt-2" size="sm" variant="outline" asChild>
                    <Link
                      href={`/dashboard/products/${issue.stockUnit.variantSize.variant.product.id}/inventory/${issue.stockUnit.id}`}
                    >
                      Resolve issue
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
