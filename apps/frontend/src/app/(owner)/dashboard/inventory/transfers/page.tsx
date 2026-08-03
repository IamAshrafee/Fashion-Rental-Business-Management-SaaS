'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  inventoryApi,
  type InventoryTransfer,
  type InventoryTransferUnitOutcome,
} from '@/lib/api/inventory';
import { productApi } from '@/lib/api/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
const apiMessage = (error: unknown, fallback: string) => {
  const value = (error as { response?: { data?: { message?: string | { message?: string } } } })
    ?.response?.data?.message;
  return typeof value === 'string' ? value : value?.message || fallback;
};

function CreateTransferDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [productId, setProductId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });
  const products = useQuery({
    queryKey: ['products-for-transfer'],
    queryFn: () => productApi.list({ limit: 100, sort: 'name', order: 'asc' }),
    enabled: open,
  });
  const product = useQuery({
    queryKey: ['transfer-product', productId],
    queryFn: () => productApi.getById(productId),
    enabled: open && !!productId,
  });
  const skus = useMemo(
    () =>
      product.data?.variants.flatMap((variant) =>
        variant.sizes.map((size) => ({
          id: size.id,
          trackingMode: size.trackingMode,
          label: `${variant.variantName || variant.mainColor.name} · ${size.sizeInstance.displayLabel}`,
        })),
      ) || [],
    [product.data],
  );
  const selectedSku = skus.find((sku) => sku.id === skuId);
  const units = useQuery({
    queryKey: ['transfer-stock-units', skuId],
    queryFn: () => productApi.listStockUnits(skuId),
    enabled: open && selectedSku?.trackingMode === 'SERIALIZED',
  });
  const eligibleUnits =
    units.data?.filter(
      (unit) =>
        unit.locationId === origin &&
        unit.disposition === 'ACTIVE' &&
        unit.operationalState === 'AVAILABLE',
    ) || [];
  const create = useMutation({
    mutationFn: () =>
      inventoryApi.createTransfer({
        originLocationId: origin,
        destinationLocationId: destination,
        notes: notes || undefined,
        idempotencyKey: crypto.randomUUID(),
        lines: [
          {
            lineKind: selectedSku!.trackingMode,
            variantSizeId: skuId,
            ...(selectedSku!.trackingMode === 'POOLED'
              ? { quantity }
              : { stockUnitIds: selectedUnits }),
          },
        ],
      }),
    onSuccess: async () => {
      setOpen(false);
      setOrigin('');
      setDestination('');
      setProductId('');
      setSkuId('');
      setSelectedUnits([]);
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      toast.success('Transfer draft created');
    },
    onError: (error) => toast.error(apiMessage(error, 'Could not create transfer')),
  });
  const valid =
    origin &&
    destination &&
    origin !== destination &&
    skuId &&
    (selectedSku?.trackingMode === 'POOLED' ? quantity > 0 : selectedUnits.length > 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create inventory transfer</DialogTitle>
          <DialogDescription>
            The draft is capacity-checked and stock is reserved only when a manager marks it ready.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Origin</Label>
            <Select
              value={origin}
              onValueChange={(value) => {
                setOrigin(value);
                setSelectedUnits([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select origin" />
              </SelectTrigger>
              <SelectContent>
                {locations.data
                  ?.filter((location) => location.canStoreInventory && location.canTransfer)
                  .map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Destination</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {locations.data
                  ?.filter((location) => location.id !== origin && location.canStoreInventory)
                  .map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Product</Label>
            <Select
              value={productId}
              onValueChange={(value) => {
                setProductId(value);
                setSkuId('');
                setSelectedUnits([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.data?.data.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>SKU / size</Label>
            <Select
              value={skuId}
              onValueChange={(value) => {
                setSkuId(value);
                setSelectedUnits([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select SKU" />
              </SelectTrigger>
              <SelectContent>
                {skus.map((sku) => (
                  <SelectItem key={sku.id} value={sku.id}>
                    {sku.label} · {humanize(sku.trackingMode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedSku?.trackingMode === 'POOLED' && (
          <div className="grid gap-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        )}
        {selectedSku?.trackingMode === 'SERIALIZED' && (
          <div className="space-y-2">
            <Label>Select available physical items at origin</Label>
            {units.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading items…</p>
            ) : !eligibleUnits.length ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No available items for this SKU at the selected origin.
              </p>
            ) : (
              eligibleUnits.map((unit) => (
                <label
                  key={unit.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    checked={selectedUnits.includes(unit.id)}
                    onCheckedChange={(checked) =>
                      setSelectedUnits((current) =>
                        checked ? [...current, unit.id] : current.filter((id) => id !== unit.id),
                      )
                    }
                  />
                  <span>
                    <span className="block font-mono text-sm">{unit.assetCode}</span>
                    <span className="block text-xs text-muted-foreground">
                      {humanize(unit.condition)}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}
        <div className="mt-4 grid gap-2">
          <Label>Transfer notes</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Reason, courier, packing instructions, or handoff details"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonAction({
  transfer,
  action,
  label,
  refresh,
  destructive = false,
}: {
  transfer: InventoryTransfer;
  action: 'ready' | 'dispatch' | 'cancel';
  label: string;
  refresh: () => Promise<void>;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => inventoryApi.transferAction(transfer.id, action, reason),
    onSuccess: async () => {
      setOpen(false);
      setReason('');
      await refresh();
      toast.success(`Transfer ${label.toLowerCase()} complete`);
    },
    onError: (error) => toast.error(apiMessage(error, 'Transfer action failed')),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={destructive ? 'destructive' : action === 'ready' ? 'default' : 'outline'}
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} {transfer.transferNumber}
          </DialogTitle>
          <DialogDescription>
            This transition is atomic and recorded in the transfer history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>Operational reason / handoff note</Label>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({
  transfer,
  refresh,
}: {
  transfer: InventoryTransfer;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pooled, setPooled] = useState<
    Record<string, { receivedQuantity: number; damagedQuantity: number; lostQuantity: number }>
  >({});
  const [outcomes, setOutcomes] = useState<Record<string, InventoryTransferUnitOutcome>>({});
  const receive = useMutation({
    mutationFn: () =>
      inventoryApi.receiveTransfer(transfer.id, {
        reason,
        lines: transfer.lines
          .map((line) =>
            line.lineKind === 'POOLED'
              ? {
                  transferLineId: line.id,
                  receivedQuantity: pooled[line.id]?.receivedQuantity ?? 0,
                  damagedQuantity: pooled[line.id]?.damagedQuantity ?? 0,
                  lostQuantity: pooled[line.id]?.lostQuantity ?? 0,
                }
              : {
                  transferLineId: line.id,
                  units: line.units
                    .filter((unit) => unit.outcome === 'PENDING' && outcomes[unit.stockUnitId])
                    .map((unit) => ({
                      stockUnitId: unit.stockUnitId,
                      outcome: outcomes[unit.stockUnitId],
                    })),
                },
          )
          .filter((line) =>
            'units' in line
              ? (line.units?.length ?? 0) > 0
              : line.receivedQuantity + line.damagedQuantity + line.lostQuantity > 0,
          ),
      }),
    onSuccess: async () => {
      setOpen(false);
      setReason('');
      setPooled({});
      setOutcomes({});
      await refresh();
      toast.success('Receipt recorded');
    },
    onError: (error) => toast.error(apiMessage(error, 'Could not receive transfer')),
  });
  const accounted =
    Object.values(pooled).some(
      (value) => value.receivedQuantity + value.damagedQuantity + value.lostQuantity > 0,
    ) || Object.keys(outcomes).length > 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Receive stock</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive {transfer.transferNumber}</DialogTitle>
          <DialogDescription>
            Count good, damaged, and lost stock. Discrepancies move the transfer to reconciliation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {transfer.lines.map((line) => (
            <div key={line.id} className="rounded-md border p-4">
              <p className="font-medium">{line.variantSize.variant.product.name}</p>
              <p className="mb-3 text-xs text-muted-foreground">
                {line.variantSize.variant.variantName || 'Default variant'} ·{' '}
                {line.variantSize.sizeInstance.displayLabel} · dispatched {line.dispatchedQuantity}
              </p>
              {line.lineKind === 'POOLED' ? (
                <div className="grid grid-cols-3 gap-3">
                  {(['receivedQuantity', 'damagedQuantity', 'lostQuantity'] as const).map(
                    (field) => (
                      <div key={field} className="grid gap-1">
                        <Label>
                          {field === 'receivedQuantity'
                            ? 'Good'
                            : field === 'damagedQuantity'
                              ? 'Damaged'
                              : 'Lost'}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={pooled[line.id]?.[field] ?? 0}
                          onChange={(event) =>
                            setPooled((current) => ({
                              ...current,
                              [line.id]: {
                                receivedQuantity: current[line.id]?.receivedQuantity ?? 0,
                                damagedQuantity: current[line.id]?.damagedQuantity ?? 0,
                                lostQuantity: current[line.id]?.lostQuantity ?? 0,
                                [field]: Math.max(0, Number(event.target.value) || 0),
                              },
                            }))
                          }
                        />
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {line.units
                    .filter((unit) => unit.outcome === 'PENDING')
                    .map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-muted/30 p-2"
                      >
                        <span className="font-mono text-sm">{unit.stockUnit.assetCode}</span>
                        <Select
                          value={outcomes[unit.stockUnitId] || ''}
                          onValueChange={(value: InventoryTransferUnitOutcome) =>
                            setOutcomes((current) => ({ ...current, [unit.stockUnitId]: value }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Outcome" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RECEIVED">Received</SelectItem>
                            <SelectItem value="DAMAGED">Damaged</SelectItem>
                            <SelectItem value="LOST">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
          <div className="grid gap-2">
            <Label>Receipt / reconciliation note</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!accounted || !reason.trim() || receive.isPending}
            onClick={() => receive.mutate()}
          >
            {receive.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferCard({
  transfer,
  refresh,
}: {
  transfer: InventoryTransfer;
  refresh: () => Promise<void>;
}) {
  const accounted = transfer.lines.reduce(
    (sum, line) => sum + line.receivedQuantity + line.damagedQuantity + line.lostQuantity,
    0,
  );
  const dispatched = transfer.lines.reduce((sum, line) => sum + line.dispatchedQuantity, 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{transfer.transferNumber}</CardTitle>
            <CardDescription>
              {transfer.originLocation.name} → {transfer.destinationLocation.name} ·{' '}
              {new Date(transfer.createdAt).toLocaleString()}
            </CardDescription>
          </div>
          <Badge
            variant={
              transfer.status === 'RECONCILIATION_REQUIRED'
                ? 'destructive'
                : transfer.status === 'RECEIVED'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {humanize(transfer.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {transfer.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{line.variantSize.variant.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {line.variantSize.variant.variantName || 'Default variant'} ·{' '}
                  {line.variantSize.sizeInstance.displayLabel} · {humanize(line.lineKind)}
                </p>
              </div>
              <span>{line.requestedQuantity} requested</span>
            </div>
          ))}
        </div>
        {dispatched > 0 && (
          <p className="text-xs text-muted-foreground">
            Receipt progress: {accounted} of {dispatched} accounted
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {transfer.status === 'DRAFT' && (
            <>
              <ReasonAction
                transfer={transfer}
                action="ready"
                label="Approve and reserve"
                refresh={refresh}
              />
              <ReasonAction
                transfer={transfer}
                action="cancel"
                label="Cancel"
                refresh={refresh}
                destructive
              />
            </>
          )}
          {transfer.status === 'READY' && (
            <>
              <ReasonAction
                transfer={transfer}
                action="dispatch"
                label="Dispatch"
                refresh={refresh}
              />
              <ReasonAction
                transfer={transfer}
                action="cancel"
                label="Cancel"
                refresh={refresh}
                destructive
              />
            </>
          )}
          {['DISPATCHED', 'PARTIALLY_RECEIVED'].includes(transfer.status) && (
            <ReceiveDialog transfer={transfer} refresh={refresh} />
          )}
        </div>
        {!!transfer.events.length && (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Transfer history ({transfer.events.length})
            </summary>
            <div className="mt-2 space-y-2">
              {transfer.events.map((event) => (
                <div key={event.id} className="border-l-2 pl-3 text-xs">
                  <p className="font-medium">{humanize(event.toStatus)}</p>
                  <p className="text-muted-foreground">
                    {event.reason} · {event.actor.fullName} ·{' '}
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default function InventoryTransfersPage() {
  const queryClient = useQueryClient();
  const transfers = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: () => inventoryApi.listTransfers(),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] }),
    ]);
  };
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ArrowLeftRight className="h-6 w-6" />
            Inventory transfers
          </h1>
          <p className="text-sm text-muted-foreground">
            Reserve, dispatch, receive, and reconcile stock movement between operational locations.
          </p>
        </div>
        <CreateTransferDialog />
      </div>
      {transfers.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transfers…
        </div>
      ) : !transfers.data?.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No inventory transfers yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {transfers.data.map((transfer) => (
            <TransferCard key={transfer.id} transfer={transfer} refresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
