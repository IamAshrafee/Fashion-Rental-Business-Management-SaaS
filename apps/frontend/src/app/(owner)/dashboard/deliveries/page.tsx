'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fulfillmentApi, type DeliveryItem, type DeliveryQuery } from '@/lib/api/fulfillment';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Status Config ────────────────────────────────────────────────────────────

const COURIER_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: typeof Clock;
  group: 'awaiting' | 'transit' | 'delivered' | 'issue';
}> = {
  pickup_pending:     { label: 'Pickup Pending',     color: 'bg-amber-100 text-amber-800 border-amber-200',    icon: Clock,          group: 'awaiting' },
  pickup_assigned:    { label: 'Pickup Assigned',    color: 'bg-blue-100 text-blue-800 border-blue-200',      icon: Truck,          group: 'awaiting' },
  pickup_failed:      { label: 'Pickup Failed',      color: 'bg-red-100 text-red-800 border-red-200',         icon: AlertTriangle,  group: 'issue' },
  picked_up:          { label: 'Picked Up',          color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Package,        group: 'transit' },
  at_hub:             { label: 'At Hub',             color: 'bg-violet-100 text-violet-800 border-violet-200', icon: MapPin,         group: 'transit' },
  in_transit:         { label: 'In Transit',         color: 'bg-cyan-100 text-cyan-800 border-cyan-200',      icon: Truck,          group: 'transit' },
  at_destination:     { label: 'At Destination',     color: 'bg-teal-100 text-teal-800 border-teal-200',      icon: MapPin,         group: 'transit' },
  out_for_delivery:   { label: 'Out for Delivery',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Truck,      group: 'transit' },
  delivered:          { label: 'Delivered',           color: 'bg-green-100 text-green-800 border-green-200',   icon: CheckCircle2,   group: 'delivered' },
  partial_delivered:  { label: 'Partial Delivery',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle, group: 'issue' },
  returned_to_sender: { label: 'Returned',           color: 'bg-rose-100 text-rose-800 border-rose-200',      icon: RotateCcw,      group: 'issue' },
  cancelled:          { label: 'Cancelled',          color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: AlertTriangle,  group: 'issue' },
  on_hold:            { label: 'On Hold',            color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock,         group: 'issue' },
  unknown:            { label: 'Unknown',            color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock,          group: 'issue' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pickup_pending,pickup_assigned', label: 'Awaiting Pickup' },
  { value: 'picked_up,at_hub,in_transit,at_destination,out_for_delivery', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'pickup_failed,returned_to_sender,on_hold,partial_delivered', label: 'Issues' },
];

function getStatusConfig(status: string | null) {
  return COURIER_STATUS_CONFIG[status ?? 'unknown'] ?? COURIER_STATUS_CONFIG.unknown;
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: Record<string, number> }) {
  const groups = {
    awaiting: { label: 'Awaiting Pickup', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', count: 0 },
    transit:  { label: 'In Transit',      icon: Truck, color: 'text-blue-600',  bg: 'bg-blue-50',  count: 0 },
    delivered: { label: 'Delivered',       icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', count: 0 },
    issue:    { label: 'Issues',           icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', count: 0 },
  };

  for (const [status, count] of Object.entries(summary)) {
    const config = getStatusConfig(status);
    if (groups[config.group]) {
      groups[config.group].count += count;
    }
  }

  const total = Object.values(groups).reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
      {/* Total */}
      <Card className="shadow-none border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Shipments</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.entries(groups).map(([key, group]) => {
        const Icon = group.icon;
        return (
          <Card key={key} className="shadow-none border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', group.bg)}>
                  <Icon className={cn('h-5 w-5', group.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{group.count}</p>
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function CourierStatusBadge({ status }: { status: string | null }) {
  const config = getStatusConfig(status);
  return (
    <Badge variant="outline" className={cn('text-xs font-medium border', config.color)}>
      {config.label}
    </Badge>
  );
}

// ─── Delivery Row ─────────────────────────────────────────────────────────────

function DeliveryRow({ delivery }: { delivery: DeliveryItem }) {
  const latestEvent = delivery.courierStatusHistory?.length
    ? delivery.courierStatusHistory[delivery.courierStatusHistory.length - 1]
    : null;

  return (
    <TableRow className="group">
      <TableCell>
        <Link
          href={`/dashboard/bookings/${delivery.id}`}
          className="font-semibold text-sm text-primary hover:underline"
        >
          {delivery.bookingNumber}
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          {delivery.items.map(i => i.productName).join(', ')}
        </p>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium">{delivery.deliveryName}</div>
        <div className="text-xs text-muted-foreground">{delivery.deliveryCity}</div>
      </TableCell>
      <TableCell>
        <CourierStatusBadge status={delivery.courierStatus} />
        {latestEvent && (
          <p className="text-xs text-muted-foreground mt-1">{latestEvent.label}</p>
        )}
      </TableCell>
      <TableCell>
        {delivery.trackingNumber ? (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
            {delivery.trackingNumber}
          </code>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {delivery.pickupRequestedAt
          ? format(new Date(delivery.pickupRequestedAt), 'MMM d, h:mm a')
          : '—'
        }
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/bookings/${delivery.id}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliveriesPage() {
  const [query, setQuery] = useState<DeliveryQuery>({ page: 1, limit: 20 });
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['deliveries', query],
    queryFn: () => fulfillmentApi.getDeliveries(query),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
  });

  const deliveries = data?.data ?? [];
  const summary = data?.summary ?? {};
  const meta = data?.meta;

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setQuery((prev) => ({
      ...prev,
      courierStatus: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Deliveries"
          description="Track courier shipments and monitor delivery statuses in real-time."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error */}
      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load deliveries. {(error as Error)?.message || 'Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <SummaryCards summary={summary} />

          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {meta && (
              <p className="text-sm text-muted-foreground">
                {meta.total} shipment{meta.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Table */}
          <Card className="shadow-none border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Courier Status</TableHead>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Pickup Requested</TableHead>
                  <TableHead className="text-right w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-8 w-8 text-muted-foreground/40" />
                        <p>No active deliveries found.</p>
                        <p className="text-xs">
                          Deliveries will appear here when bookings are shipped via courier.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveries.map((delivery) => (
                    <DeliveryRow key={delivery.id} delivery={delivery} />
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(meta.page - 1)}
                  disabled={meta.page <= 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(meta.page + 1)}
                  disabled={meta.page >= meta.totalPages || isFetching}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
