'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Loader2, PackageCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  inventoryApi,
  type InventoryTransfer,
  type InventoryTransferStatus,
  type InventoryTransferUnitOutcome,
} from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FieldTip } from '@/components/shared/field-tip';

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const message = (error: unknown) => (error as { response?: { data?: { message?: string | { message?: string } } } })?.response?.data?.message;
const errorMessage = (error: unknown, fallback: string) => {
  const value = message(error);
  return typeof value === 'string' ? value : value?.message || fallback;
};

function CreateTransferDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [originLocationId, setOriginLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [variantSizeId, setVariantSizeId] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [expectedArrivalAt, setExpectedArrivalAt] = useState('');
  const locations = useQuery({ queryKey: ['inventory-locations'], queryFn: () => inventoryApi.listLocations(), enabled: open });
  const skus = useQuery({ queryKey: ['inventory-skus', 'transfer'], queryFn: () => inventoryApi.listSkus({ page: 1, limit: 100 }), enabled: open });
  const items = useQuery({
    queryKey: ['inventory-items', 'transfer', originLocationId, variantSizeId],
    queryFn: () => inventoryApi.listItems({
      page: 1,
      limit: 100,
      locationId: originLocationId,
      variantSizeId,
      disposition: 'ACTIVE',
      operationalState: 'AVAILABLE',
    }),
    enabled: open && Boolean(originLocationId && variantSizeId),
  });
  const mutation = useMutation({
    mutationFn: () => inventoryApi.createTransfer({
      originLocationId,
      destinationLocationId,
      lines: [{ variantSizeId, stockUnitIds: selectedItemIds }],
      expectedArrivalAt: expectedArrivalAt || undefined,
      notes: notes.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      setOpen(false);
      setSelectedItemIds([]);
      setNotes('');
      toast.success('Transfer draft created with exact physical items');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create transfer')),
  });
  const usableLocations = locations.data?.filter((location) => location.isActive && location.canTransfer) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />New transfer</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create item transfer</DialogTitle>
          <DialogDescription>Select the exact physical items leaving one location. Quantities are derived from those identities.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Origin <FieldTip tip="The location where every selected physical item is currently stored. Items become unavailable for rental when the transfer is approved." /></Label>
            <Select value={originLocationId} onValueChange={(value) => { setOriginLocationId(value); setSelectedItemIds([]); }}><SelectTrigger><SelectValue placeholder="Select origin" /></SelectTrigger><SelectContent>{usableLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-2">
            <Label>Destination <FieldTip tip="The location that will own the items after receipt. It must be different from the origin and able to store inventory." /></Label>
            <Select value={destinationLocationId} onValueChange={setDestinationLocationId}><SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger><SelectContent>{usableLocations.filter((location) => location.id !== originLocationId && location.canStoreInventory).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Product SKU <FieldTip helpKey="catalog.sku" /></Label>
            <Select value={variantSizeId} onValueChange={(value) => { setVariantSizeId(value); setSelectedItemIds([]); }}><SelectTrigger><SelectValue placeholder="Select SKU" /></SelectTrigger><SelectContent>{skus.data?.data.map((sku) => <SelectItem key={sku.id} value={sku.id}>{sku.productName} · {sku.variantName || 'Default'} · {sku.sizeLabel}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Physical items <FieldTip helpKey="inventory.transferItems" /></Label>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
              {items.isLoading ? <Loader2 className="size-4 animate-spin" /> : !items.data?.data.length ? <p className="text-sm text-muted-foreground">No eligible items at this origin for the selected SKU.</p> : items.data.data.map((item) => <label key={item.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40"><span><span className="font-mono text-sm">{item.assetCode}</span><span className="ml-2 text-xs text-muted-foreground">{humanize(item.condition)}</span></span><Checkbox checked={selectedItemIds.includes(item.id)} onCheckedChange={(checked) => setSelectedItemIds((current) => checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></label>)}
            </div>
          </div>
          <div className="grid gap-2"><Label htmlFor="transfer-arrival">Expected arrival</Label><Input id="transfer-arrival" type="datetime-local" value={expectedArrivalAt} onChange={(event) => setExpectedArrivalAt(event.target.value)} /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="transfer-notes">Notes</Label><Textarea id="transfer-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Packing, handoff, or routing notes" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!originLocationId || !destinationLocationId || !variantSizeId || !selectedItemIds.length || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Create {selectedItemIds.length}-item draft</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveTransferDialog({ transfer }: { transfer: InventoryTransfer }) {
  const queryClient = useQueryClient();
  const pending = transfer.lines.flatMap((line) => line.units.filter((unit) => unit.outcome === 'PENDING').map((unit) => ({ lineId: line.id, unit })));
  const [open, setOpen] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, InventoryTransferUnitOutcome>>({});
  const [reason, setReason] = useState('Received and inspected at destination');
  const payloadLines = useMemo(() => transfer.lines.map((line) => ({
    transferLineId: line.id,
    units: line.units.filter((unit) => unit.outcome === 'PENDING' && outcomes[unit.id]).map((unit) => ({ stockUnitId: unit.stockUnitId, outcome: outcomes[unit.id] })),
  })).filter((line) => line.units.length), [outcomes, transfer.lines]);
  const mutation = useMutation({
    mutationFn: () => inventoryApi.receiveTransfer(transfer.id, { lines: payloadLines, reason }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] }); setOpen(false); toast.success('Physical-item outcomes recorded'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not receive transfer items')),
  });
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setOutcomes(Object.fromEntries(pending.map(({ unit }) => [unit.id, 'RECEIVED']))); }}><DialogTrigger asChild><Button size="sm" variant="outline"><PackageCheck className="mr-2 size-4" />Receive items</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Record receipt outcomes</DialogTitle><DialogDescription>Confirm each pending physical item as received, damaged, or lost. This creates item-level lifecycle and movement history.</DialogDescription></DialogHeader><div className="max-h-80 space-y-2 overflow-y-auto py-2">{pending.map(({ unit }) => <div key={unit.id} className="grid grid-cols-[1fr_11rem] items-center gap-3 rounded-md border p-3"><span className="font-mono text-sm">{unit.stockUnit.assetCode}</span><Select value={outcomes[unit.id] ?? 'RECEIVED'} onValueChange={(value) => setOutcomes((current) => ({ ...current, [unit.id]: value as InventoryTransferUnitOutcome }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['RECEIVED', 'DAMAGED', 'LOST'] as const).map((value) => <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="grid gap-2"><Label>Receipt reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!payloadLines.length || !reason.trim() || mutation.isPending} onClick={() => mutation.mutate()}>Record {payloadLines.reduce((sum, line) => sum + line.units.length, 0)} outcomes</Button></DialogFooter></DialogContent></Dialog>;
}

function TransferCard({ transfer }: { transfer: InventoryTransfer }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const action = useMutation({
    mutationFn: (name: 'ready' | 'dispatch' | 'cancel' | 'reconcile') => inventoryApi.transferAction(transfer.id, name, reason.trim() || `${humanize(name)} transfer`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] }); setReason(''); toast.success('Transfer updated'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not update transfer')),
  });
  const units = transfer.lines.flatMap((line) => line.units);
  const counts = Object.fromEntries((['PENDING', 'RECEIVED', 'DAMAGED', 'LOST'] as const).map((outcome) => [outcome, units.filter((unit) => unit.outcome === outcome).length]));
  const availableActions: Array<'ready' | 'dispatch' | 'cancel' | 'reconcile'> = transfer.status === 'DRAFT' ? ['ready', 'cancel'] : transfer.status === 'READY' ? ['dispatch', 'cancel'] : transfer.status === 'RECONCILIATION_REQUIRED' ? ['reconcile'] : [];
  return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{transfer.transferNumber}</CardTitle><CardDescription>{transfer.originLocation.name} → {transfer.destinationLocation.name}</CardDescription></div><Badge>{humanize(transfer.status)}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-4 gap-2 text-center text-sm"><div><p className="font-semibold">{units.length}</p><p className="text-xs text-muted-foreground">Selected</p></div><div><p className="font-semibold">{counts.RECEIVED}</p><p className="text-xs text-muted-foreground">Received</p></div><div><p className="font-semibold">{counts.DAMAGED}</p><p className="text-xs text-muted-foreground">Damaged</p></div><div><p className="font-semibold">{counts.LOST}</p><p className="text-xs text-muted-foreground">Lost</p></div></div><div className="space-y-2">{transfer.lines.map((line) => <div key={line.id} className="rounded-md border p-3"><p className="text-sm font-medium">{line.variantSize.variant.product.name} · {line.variantSize.variant.variantName || 'Default'} · {line.variantSize.sizeInstance.displayLabel}</p><div className="mt-2 flex flex-wrap gap-2">{line.units.map((unit) => <Badge key={unit.id} variant={unit.outcome === 'PENDING' ? 'outline' : unit.outcome === 'RECEIVED' ? 'secondary' : 'destructive'}>{unit.stockUnit.assetCode} · {humanize(unit.outcome)}</Badge>)}</div></div>)}</div>{availableActions.length ? <div className="space-y-2 border-t pt-3"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for this action" /><div className="flex flex-wrap gap-2">{availableActions.map((name) => <Button key={name} size="sm" variant={name === 'cancel' ? 'destructive' : 'outline'} disabled={action.isPending} onClick={() => action.mutate(name)}>{humanize(name)}</Button>)}</div></div> : null}{['DISPATCHED', 'PARTIALLY_RECEIVED'].includes(transfer.status) && counts.PENDING > 0 ? <ReceiveTransferDialog transfer={transfer} /> : null}</CardContent></Card>;
}

export default function InventoryTransfersPage() {
  const [status, setStatus] = useState<InventoryTransferStatus | 'ALL'>('ALL');
  const query = useQuery({ queryKey: ['inventory-transfers', status], queryFn: () => inventoryApi.listTransfers(status === 'ALL' ? undefined : status) });
  return <div className="space-y-6 pb-10"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Inventory transfers</h1><p className="text-sm text-muted-foreground">Move exact physical-item identities between locations with auditable dispatch and receipt outcomes.</p></div><CreateTransferDialog /></div><Select value={status} onValueChange={(value) => setStatus(value as InventoryTransferStatus | 'ALL')}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem>{(['DRAFT', 'READY', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RECONCILIATION_REQUIRED', 'RECONCILED', 'CANCELLED'] as const).map((value) => <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>)}</SelectContent></Select>{query.isLoading ? <div className="flex py-12"><Loader2 className="size-5 animate-spin" /></div> : query.isError ? <Card><CardContent className="p-8 text-center">Transfers could not be loaded.</CardContent></Card> : !query.data?.length ? <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><ArrowLeftRight className="size-8 text-muted-foreground" /><p className="font-medium">No transfers found</p><p className="text-sm text-muted-foreground">Create a draft by selecting exact items from an origin location.</p></CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">{query.data.map((transfer) => <TransferCard key={transfer.id} transfer={transfer} />)}</div>}</div>;
}
