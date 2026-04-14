'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card } from '@/components/ui/card';
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
  Send,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fulfillmentApi, type DeliveryItem, type DeliveryQuery, type DeliveryStage } from '@/lib/api/fulfillment';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Status Config ────────────────────────────────────────────────────────────

const COURIER_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  prepare_parcel:     { label: 'Preparing Parcel',   color: 'bg-amber-100 text-amber-800 border-amber-200',    icon: Package },
  pickup_pending:     { label: 'Pickup Pending',     color: 'bg-blue-100 text-blue-800 border-blue-200',      icon: Clock },
  pickup_assigned:    { label: 'Pickup Assigned',    color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck },
  pickup_failed:      { label: 'Pickup Failed',      color: 'bg-red-100 text-red-800 border-red-200',         icon: AlertTriangle },
  picked_up:          { label: 'Picked Up',          color: 'bg-cyan-100 text-cyan-800 border-cyan-200',      icon: Package },
  at_hub:             { label: 'At Hub',             color: 'bg-violet-100 text-violet-800 border-violet-200', icon: MapPin },
  in_transit:         { label: 'In Transit',         color: 'bg-sky-100 text-sky-800 border-sky-200',         icon: Truck },
  at_destination:     { label: 'At Destination',     color: 'bg-teal-100 text-teal-800 border-teal-200',      icon: MapPin },
  out_for_delivery:   { label: 'Out for Delivery',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Truck },
  delivered:          { label: 'Delivered',           color: 'bg-green-100 text-green-800 border-green-200',   icon: CheckCircle2 },
  partial_delivered:  { label: 'Partial Delivery',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
  returned_to_sender: { label: 'Returned',           color: 'bg-rose-100 text-rose-800 border-rose-200',      icon: RotateCcw },
  cancelled:          { label: 'Cancelled',          color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: AlertTriangle },
  on_hold:            { label: 'On Hold',            color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock },
  error:              { label: 'Error',              color: 'bg-red-100 text-red-800 border-red-200',         icon: AlertTriangle },
  unknown:            { label: 'Unknown',            color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock },
};

function getStatusConfig(status: string | null) {
  return COURIER_STATUS_CONFIG[status ?? 'unknown'] ?? COURIER_STATUS_CONFIG.unknown;
}

// ─── Stage Tabs Config ────────────────────────────────────────────────────────

const STAGES: Array<{ value: DeliveryStage; label: string; icon: typeof Package; colorClass: string }> = [
  { value: 'prepare_parcel', label: 'Prepare Parcel', icon: Package, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'awaiting_pickup', label: 'Awaiting Pickup', icon: Clock, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'in_transit', label: 'In Transit', icon: Truck, colorClass: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle2, colorClass: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'error', label: 'Issues', icon: AlertTriangle, colorClass: 'text-red-600 bg-red-50 border-red-200' },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function CourierStatusBadge({ status }: { status: string | null }) {
  const config = getStatusConfig(status);
  return (
    <Badge variant="outline" className={cn('text-xs font-medium border truncate max-w-[120px]', config.color)}>
      {config.label}
    </Badge>
  );
}

// ─── Delivery Row ─────────────────────────────────────────────────────────────

function DeliveryRow({ delivery, activeStage }: { delivery: DeliveryItem; activeStage: DeliveryStage }) {
  const queryClient = useQueryClient();
  const latestEvent = delivery.courierStatusHistory?.length
    ? delivery.courierStatusHistory[delivery.courierStatusHistory.length - 1]
    : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deliveries'] });

  const sendPickupMutation = useMutation({
    mutationFn: (id: string) => fulfillmentApi.sendPickup(id),
    onSuccess: () => { toast.success('Pickup request sent'); invalidate(); },
    onError: (err: any) => { toast.error(err.message || 'Failed to send pickup request'); },
  });

  const updateStageMutation = useMutation({
    mutationFn: (payload: { stage: DeliveryStage; reason?: string }) =>
      fulfillmentApi.updateStage(delivery.id, payload),
    onSuccess: (_data, vars) => {
      toast.success(`Delivery marked as ${vars.stage.replace(/_/g, ' ')}`);
      invalidate();
    },
    onError: (err: any) => { toast.error(err.message || 'Failed to update stage'); },
  });

  const isBusy = sendPickupMutation.isPending || updateStageMutation.isPending;

  return (
    <TableRow className="group">
      <TableCell>
        <Link
          href={`/dashboard/bookings/${delivery.id}`}
          className="font-semibold text-sm text-primary hover:underline"
        >
          {delivery.bookingNumber}
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[200px]">
          {delivery.items.map(i => i.productName).join(', ')}
        </p>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium">{delivery.deliveryName}</div>
        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{delivery.deliveryCity}</div>
      </TableCell>
      <TableCell>
        {activeStage === 'prepare_parcel' ? (
           <div className="flex flex-col gap-1 text-xs">
             {delivery.scheduledPickupAt && (
               <span className="text-muted-foreground">Scheduled: <span className="font-medium text-foreground">{format(new Date(delivery.scheduledPickupAt), 'MMM d, ha')}</span></span>
             )}
             <span className="text-muted-foreground">Lead: {delivery.deliveryLeadDays} days</span>
           </div>
        ) : (
          <div>
            <CourierStatusBadge status={delivery.courierStatus} />
            {latestEvent && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 max-w-[150px]" title={latestEvent.label}>{latestEvent.label}</p>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        {delivery.trackingNumber ? (
          <div>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono block w-fit">
              {delivery.trackingNumber}
            </code>
            {delivery.courierProvider && (
              <span className="text-[10px] text-muted-foreground capitalize mt-0.5 block">{delivery.courierProvider}</span>
            )}
          </div>
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
        <div className="flex items-center justify-end gap-1.5">
          {/* ── Prepare Parcel actions ── */}
          {activeStage === 'prepare_parcel' && (
            <>
              <Button size="sm" disabled={isBusy} onClick={() => sendPickupMutation.mutate(delivery.id)}>
                {sendPickupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Send Pickup
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={isBusy}
                onClick={() => {
                  const reason = prompt('Reason for marking as error:');
                  if (reason) updateStageMutation.mutate({ stage: 'error', reason });
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Error
              </Button>
            </>
          )}

          {/* ── Awaiting Pickup actions ── */}
          {activeStage === 'awaiting_pickup' && (
            <>
              <Button size="sm" variant="outline" disabled={isBusy}
                onClick={() => updateStageMutation.mutate({ stage: 'in_transit' })}
              >
                <Truck className="h-3.5 w-3.5 mr-1.5" /> Mark In Transit
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={isBusy}
                onClick={() => {
                  const reason = prompt('Reason for marking as error:');
                  if (reason) updateStageMutation.mutate({ stage: 'error', reason });
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Error
              </Button>
            </>
          )}

          {/* ── In Transit actions ── */}
          {activeStage === 'in_transit' && (
            <>
              <Button size="sm" disabled={isBusy}
                onClick={() => updateStageMutation.mutate({ stage: 'delivered' })}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Delivered
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={isBusy}
                onClick={() => {
                  const reason = prompt('Reason for marking as error:');
                  if (reason) updateStageMutation.mutate({ stage: 'error', reason });
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Error
              </Button>
            </>
          )}

          {/* ── Error / Issues actions ── */}
          {activeStage === 'error' && (
            <>
              <Button size="sm" variant="outline" disabled={isBusy}
                onClick={() => updateStageMutation.mutate({ stage: 'prepare_parcel' })}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry → Prepare
              </Button>
              <Button size="sm" variant="outline" disabled={isBusy}
                onClick={() => sendPickupMutation.mutate(delivery.id)}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" /> Retry Pickup
              </Button>
            </>
          )}

          {/* Always show View link */}
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/bookings/${delivery.id}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliveriesPage() {
  const [query, setQuery] = useState<DeliveryQuery>({ stage: 'prepare_parcel', page: 1, limit: 20 });

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['deliveries', query],
    queryFn: () => fulfillmentApi.getDeliveries(query),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
  });

  const deliveries = data?.data ?? [];
  const stageSummary = data?.stageSummary ?? {
    prepare_parcel: 0,
    awaiting_pickup: 0,
    in_transit: 0,
    delivered: 0,
    error: 0,
  };
  const meta = data?.meta;

  const handleStageChange = (stage: DeliveryStage) => {
    setQuery((prev) => ({
      ...prev,
      stage,
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
          description="Manage fulfillment lifecycle across your bookings."
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
        <div className="space-y-6">
          {/* Stage Tabs */}
          <div className="flex flex-wrap gap-2">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              const isActive = query.stage === stage.value;
              const count = stageSummary[stage.value] || 0;
              
              return (
                <button
                  key={stage.value}
                  onClick={() => handleStageChange(stage.value)}
                  className={cn(
                    "flex flex-1 min-w-[150px] flex-col items-center gap-2 rounded-lg border p-4 transition-all hover:bg-muted/50",
                    isActive ? cn("ring-2 ring-primary ring-offset-1 border-transparent shadow-sm", stage.colorClass) : "bg-card text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Icon className="h-5 w-5" />
                    <span className="text-2xl">{count}</span>
                  </div>
                  <span className="text-xs uppercase tracking-wider font-semibold opacity-80">{stage.label}</span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <Card className="shadow-none border">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
              <h3 className="font-medium text-sm">
                Showing <span className="font-bold">{meta?.total || 0}</span> {STAGES.find(s => s.value === query.stage)?.label.toLowerCase()}
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status / Details</TableHead>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-8 w-8 text-muted-foreground/40" />
                        <p>No {query.stage ? STAGES.find(s => s.value === query.stage)?.label.toLowerCase() : 'active'} deliveries found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveries.map((delivery) => (
                    <DeliveryRow key={delivery.id} delivery={delivery} activeStage={query.stage as DeliveryStage} />
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
        </div>
      )}
    </div>
  );
}
