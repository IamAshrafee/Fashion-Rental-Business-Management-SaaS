'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
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

const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());

export default function InventoryItemsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('all');
  const [state, setState] = useState('all');
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });
  const items = useQuery({
    queryKey: ['inventory-items', page, search, locationId, state],
    queryFn: () =>
      inventoryApi.listItems({
        page,
        limit: 25,
        search: search || undefined,
        locationId: locationId === 'all' ? undefined : locationId,
        operationalState: state === 'all' ? undefined : state,
      }),
  });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Physical items</h1>
        <p className="text-sm text-muted-foreground">
          Every serialized rental piece across products and locations.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Asset code, barcode, or product"
            />
          </div>
          <Select
            value={locationId}
            onValueChange={(value) => {
              setLocationId(value);
              setPage(1);
            }}
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
            value={state}
            onValueChange={(value) => {
              setState(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All operational states</SelectItem>
              {[
                'AVAILABLE',
                'PREPARING',
                'READY',
                'OUT_FOR_RENTAL',
                'AWAITING_INSPECTION',
                'CLEANING',
                'WASHING',
                'REPAIRING',
                'IN_TRANSFER',
              ].map((value) => (
                <SelectItem key={value} value={value}>
                  {humanize(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {items.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading physical items…
            </div>
          ) : !items.data?.data.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No physical items match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Product / SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Operational state</TableHead>
                    <TableHead>Rental history</TableHead>
                    <TableHead>Current value</TableHead>
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
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.operationalState === 'AVAILABLE' ? 'default' : 'secondary'}
                        >
                          {humanize(item.operationalState)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>{item.rentalMetrics.completedRentals} completed</p>
                        <p className="text-muted-foreground">
                          {item.rentalMetrics.totalRentalDays} rental days
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.estimatedCurrentValue == null
                          ? '—'
                          : `৳${item.estimatedCurrentValue.toLocaleString()}`}
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
          )}
          {items.data && (
            <div className="flex items-center justify-between border-t p-4 text-sm">
              <p className="text-muted-foreground">{items.data.meta.total} items</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span className="px-2 py-1 text-muted-foreground">
                  {page} / {items.data.meta.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= items.data.meta.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
