'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarOff, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  inventoryApi,
  type AvailabilityPolicy,
  type AvailabilityPolicyInput,
  type AvailabilityPolicyScope,
  type InventoryBlockInput,
  type InventoryItem,
  type InventorySku,
} from '@/lib/api/inventory';
import { productApi } from '@/lib/api/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { OwnerListEmpty, OwnerListError, OwnerListPagination, OwnerTableSkeleton } from '@/components/owner/workspace';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'] as const;
const operationalStates = ['AVAILABLE', 'PREPARING', 'READY', 'OUT_FOR_RENTAL', 'AWAITING_INSPECTION', 'CLEANING', 'WASHING', 'REPAIRING', 'IN_TRANSFER'] as const;
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const errorMessage = (error: unknown, fallback: string) => {
  const value = (error as { response?: { data?: { message?: string | { message?: string } } } })?.response?.data?.message;
  return typeof value === 'string' ? value : value?.message || fallback;
};
const today = () => new Date().toISOString().slice(0, 10);

type PolicyForm = {
  preparationHours: string;
  deliveryHours: string;
  returnHours: string;
  inspectionHours: string;
  cleaningHours: string;
  noticeHours: string;
  maximumAdvanceDays: string;
  pendingHoldMinutes: string;
  transferLeadHours: string;
  allowShortage: 'inherit' | 'yes' | 'no';
  shortageLimit: string;
  singleLocation: 'inherit' | 'yes' | 'no';
  crossLocation: 'inherit' | 'yes' | 'no';
  conditionOverride: boolean;
  eligibleConditions: string[];
  stateOverride: boolean;
  eligibleStates: string[];
};

const emptyPolicy: PolicyForm = {
  preparationHours: '', deliveryHours: '', returnHours: '', inspectionHours: '', cleaningHours: '', noticeHours: '',
  maximumAdvanceDays: '', pendingHoldMinutes: '', transferLeadHours: '', allowShortage: 'inherit', shortageLimit: '',
  singleLocation: 'inherit', crossLocation: 'inherit', conditionOverride: false,
  eligibleConditions: ['NEW', 'EXCELLENT', 'GOOD', 'FAIR'], stateOverride: false, eligibleStates: ['AVAILABLE'],
};

function policyTargetLabel(policy: AvailabilityPolicy) {
  if (policy.scope === 'TENANT') return 'Business default';
  if (policy.location) return `${policy.location.name} (${policy.location.code})`;
  if (policy.product) return policy.product.name;
  if (policy.variantSize) return `${policy.variantSize.variant.product.name} · ${policy.variantSize.variant.variantName || 'Default'} · ${policy.variantSize.sizeInstance.displayLabel}`;
  return policy.scopeKey;
}

function minutes(value: string) {
  return value === '' ? undefined : Math.max(0, Math.round(Number(value) * 60));
}

function optionalInt(value: string) {
  return value === '' ? undefined : Math.max(0, Math.round(Number(value)));
}

function booleanValue(value: 'inherit' | 'yes' | 'no') {
  return value === 'inherit' ? undefined : value === 'yes';
}

function PolicyWorkspace({ locations, skus }: { locations: Awaited<ReturnType<typeof inventoryApi.listLocations>>; skus: InventorySku[] }) {
  const queryClient = useQueryClient();
  const policies = useQuery({ queryKey: ['inventory-policies'], queryFn: inventoryApi.listPolicies });
  const products = useMemo(() => [...new Map(skus.map((sku) => [sku.productId, { id: sku.productId, name: sku.productName }])).values()], [skus]);
  const [scope, setScope] = useState<AvailabilityPolicyScope>('TENANT');
  const [targetId, setTargetId] = useState('TENANT');
  const [form, setForm] = useState<PolicyForm>(emptyPolicy);
  const selected = policies.data?.find((policy) => policy.scope === scope && (scope === 'TENANT' ? true : policy.locationId === targetId || policy.productId === targetId || policy.variantSizeId === targetId));

  useEffect(() => {
    if (!selected) { setForm(emptyPolicy); return; }
    setForm({
      preparationHours: selected.preparationBufferMinutes === null ? '' : String(selected.preparationBufferMinutes / 60),
      deliveryHours: selected.deliveryBufferMinutes === null ? '' : String(selected.deliveryBufferMinutes / 60),
      returnHours: selected.returnBufferMinutes === null ? '' : String(selected.returnBufferMinutes / 60),
      inspectionHours: selected.inspectionBufferMinutes === null ? '' : String(selected.inspectionBufferMinutes / 60),
      cleaningHours: selected.cleaningBufferMinutes === null ? '' : String(selected.cleaningBufferMinutes / 60),
      noticeHours: selected.minimumNoticeMinutes === null ? '' : String(selected.minimumNoticeMinutes / 60),
      maximumAdvanceDays: selected.maximumAdvanceDays === null ? '' : String(selected.maximumAdvanceDays),
      pendingHoldMinutes: selected.pendingHoldMinutes === null ? '' : String(selected.pendingHoldMinutes),
      transferLeadHours: selected.transferLeadTimeMinutes === null ? '' : String(selected.transferLeadTimeMinutes / 60),
      allowShortage: selected.allowShortage === null ? 'inherit' : selected.allowShortage ? 'yes' : 'no',
      shortageLimit: selected.shortageLimit === null ? '' : String(selected.shortageLimit),
      singleLocation: selected.requireSingleLocationForBundle === null ? 'inherit' : selected.requireSingleLocationForBundle ? 'yes' : 'no',
      crossLocation: selected.allowCrossLocationTransfers === null ? 'inherit' : selected.allowCrossLocationTransfers ? 'yes' : 'no',
      conditionOverride: !!selected.eligibleConditionGrades?.length,
      eligibleConditions: selected.eligibleConditionGrades || ['NEW', 'EXCELLENT', 'GOOD', 'FAIR'],
      stateOverride: !!selected.eligibleOperationalStates?.length,
      eligibleStates: selected.eligibleOperationalStates || ['AVAILABLE'],
    });
  }, [selected]);

  const targetOptions = useMemo(
    () => scope === 'LOCATION' ? locations.map((location) => ({ id: location.id, label: location.name })) : scope === 'PRODUCT' ? products.map((product) => ({ id: product.id, label: product.name })) : scope === 'SKU' ? skus.map((sku) => ({ id: sku.id, label: `${sku.productName} · ${sku.variantName || 'Default'} · ${sku.sizeLabel}` })) : [{ id: 'TENANT', label: 'Business default' }],
    [locations, products, scope, skus],
  );
  useEffect(() => {
    const first = targetOptions[0]?.id || '';
    if (!targetOptions.some((option) => option.id === targetId)) setTargetId(first);
  }, [scope, targetId, targetOptions]);

  const input = (): AvailabilityPolicyInput => ({
    scope,
    expectedVersion: selected?.version ?? 0,
    ...(scope === 'LOCATION' ? { locationId: targetId } : {}),
    ...(scope === 'PRODUCT' ? { productId: targetId } : {}),
    ...(scope === 'SKU' ? { variantSizeId: targetId } : {}),
    preparationBufferMinutes: minutes(form.preparationHours), deliveryBufferMinutes: minutes(form.deliveryHours),
    returnBufferMinutes: minutes(form.returnHours), inspectionBufferMinutes: minutes(form.inspectionHours),
    cleaningBufferMinutes: minutes(form.cleaningHours), minimumNoticeMinutes: minutes(form.noticeHours),
    maximumAdvanceDays: optionalInt(form.maximumAdvanceDays), pendingHoldMinutes: optionalInt(form.pendingHoldMinutes),
    transferLeadTimeMinutes: minutes(form.transferLeadHours), allowShortage: booleanValue(form.allowShortage),
    shortageLimit: optionalInt(form.shortageLimit), requireSingleLocationForBundle: booleanValue(form.singleLocation),
    allowCrossLocationTransfers: booleanValue(form.crossLocation),
    ...(form.conditionOverride ? { eligibleConditionGrades: form.eligibleConditions as AvailabilityPolicyInput['eligibleConditionGrades'] } : {}),
    ...(form.stateOverride ? { eligibleOperationalStates: form.eligibleStates as AvailabilityPolicyInput['eligibleOperationalStates'] } : {}),
  });
  const save = useMutation({
    mutationFn: () => inventoryApi.upsertPolicy(input()),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['inventory-policies'] }); toast.success('Availability policy saved'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not save availability policy')),
  });
  const deactivate = useMutation({
    mutationFn: () => inventoryApi.deactivatePolicy(selected!.id, selected!.version),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['inventory-policies'] }); toast.success('Policy override deactivated'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not deactivate policy')),
  });
  const set = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleList = (key: 'eligibleConditions' | 'eligibleStates', value: string) => setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));

  const selectedSku = skus.find((sku) => sku.id === targetId);
  const [resolveLocationId, setResolveLocationId] = useState(locations.find((location) => location.isDefault)?.id || locations[0]?.id || '');
  const resolved = useQuery({
    queryKey: ['resolved-inventory-policy', selectedSku?.productId, selectedSku?.id, resolveLocationId],
    queryFn: () => inventoryApi.resolvePolicy({ productId: selectedSku!.productId, variantSizeId: selectedSku!.id, locationId: resolveLocationId }),
    enabled: scope === 'SKU' && !!selectedSku && !!resolveLocationId,
  });

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Policy layer</CardTitle><CardDescription>Blank fields inherit from the broader layer. Priority is business → product → location → SKU; stale edits are rejected.</CardDescription></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Scope</Label><Select value={scope} onValueChange={(value) => setScope(value as AvailabilityPolicyScope)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['TENANT', 'LOCATION', 'PRODUCT', 'SKU'] as const).map((value) => <SelectItem key={value} value={value}>{value === 'TENANT' ? 'Business default' : humanize(value)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Target</Label><Select value={targetId} onValueChange={setTargetId} disabled={scope === 'TENANT' || !targetOptions.length}><SelectTrigger><SelectValue placeholder="Choose target" /></SelectTrigger><SelectContent>{targetOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
        ['preparationHours', 'Preparation (hours)'], ['deliveryHours', 'Delivery (hours)'], ['returnHours', 'Return (hours)'], ['inspectionHours', 'Inspection (hours)'], ['cleaningHours', 'Cleaning (hours)'], ['noticeHours', 'Minimum notice (hours)'], ['maximumAdvanceDays', 'Maximum advance (days)'], ['pendingHoldMinutes', 'Pending hold (minutes)'], ['transferLeadHours', 'Transfer lead (hours)'], ['shortageLimit', 'Shortage limit'],
      ].map(([key, label]) => <div key={key} className="grid gap-2"><Label>{label}</Label><Input type="number" min={0} placeholder="Inherit" value={form[key as keyof PolicyForm] as string} onChange={(event) => set(key as keyof PolicyForm, event.target.value as never)} /></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-3">{[
        ['allowShortage', 'Allow controlled shortage'], ['singleLocation', 'Require one bundle location'], ['crossLocation', 'Allow cross-location planning'],
      ].map(([key, label]) => <div key={key} className="grid gap-2"><Label>{label}</Label><Select value={form[key as 'allowShortage']} onValueChange={(value) => set(key as 'allowShortage', value as 'inherit' | 'yes' | 'no')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Inherit</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Eligibility label="Override eligible conditions" enabled={form.conditionOverride} onEnabled={(value) => set('conditionOverride', value)} values={conditions} selected={form.eligibleConditions} onToggle={(value) => toggleList('eligibleConditions', value)} /><Eligibility label="Override eligible operational states" enabled={form.stateOverride} onEnabled={(value) => set('stateOverride', value)} values={operationalStates} selected={form.eligibleStates} onToggle={(value) => toggleList('eligibleStates', value)} /></div>
      <div className="flex flex-wrap gap-2"><Button disabled={!targetId || save.isPending || (form.conditionOverride && !form.eligibleConditions.length) || (form.stateOverride && !form.eligibleStates.length)} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save layer</Button>{selected?.isActive && <Button variant="outline" disabled={deactivate.isPending} onClick={() => deactivate.mutate()}>Deactivate override</Button>}<span className="self-center text-xs text-muted-foreground">{selected ? `Loaded version ${selected.version}` : 'New layer'}</span></div>
    </CardContent></Card>
    {scope === 'SKU' && <Card><CardHeader><CardTitle className="text-base">Effective policy preview</CardTitle><CardDescription>Normalized result after all active layers for this SKU and fulfillment location.</CardDescription></CardHeader><CardContent className="space-y-3"><Select value={resolveLocationId} onValueChange={setResolveLocationId}><SelectTrigger className="max-w-sm"><SelectValue placeholder="Choose location" /></SelectTrigger><SelectContent>{locations.filter((location) => location.isActive).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select>{resolved.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : resolved.data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Before-rental buffer" value={`${Math.ceil((resolved.data.effective.preparationBufferMinutes + resolved.data.effective.deliveryBufferMinutes) / 1440)} day(s)`} /><Metric label="After-rental buffer" value={`${Math.ceil((resolved.data.effective.returnBufferMinutes + resolved.data.effective.inspectionBufferMinutes + resolved.data.effective.cleaningBufferMinutes) / 1440)} day(s)`} /><Metric label="Minimum notice" value={`${resolved.data.effective.minimumNoticeMinutes} min`} /><Metric label="Active layers" value={String(resolved.data.effective.sources.length)} /></div> : null}</CardContent></Card>}
    <Card><CardHeader><CardTitle className="text-base">Configured layers</CardTitle></CardHeader><CardContent className="space-y-2">{policies.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : policies.data?.map((policy) => <div key={policy.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{policyTargetLabel(policy)}</p><p className="text-xs text-muted-foreground">{humanize(policy.scope)} · version {policy.version}</p></div><Badge variant={policy.isActive ? 'secondary' : 'outline'}>{policy.isActive ? 'Active' : 'Inactive'}</Badge></div>)}</CardContent></Card>
  </div>;
}

function Eligibility({ label, enabled, onEnabled, values, selected, onToggle }: { label: string; enabled: boolean; onEnabled: (value: boolean) => void; values: readonly string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="rounded-lg border p-4"><div className="mb-3 flex items-center justify-between gap-3"><Label>{label}</Label><Switch checked={enabled} onCheckedChange={onEnabled} /></div>{enabled && <div className="flex flex-wrap gap-3">{values.map((value) => <label key={value} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(value)} onCheckedChange={() => onToggle(value)} />{humanize(value)}</label>)}</div>}</div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>; }

type TargetKind = 'PRODUCT' | 'SKU' | 'ITEM' | 'LOCATION' | 'POOL';
function BlockWorkspace({ locations, skus, items }: { locations: Awaited<ReturnType<typeof inventoryApi.listLocations>>; skus: InventorySku[]; items: InventoryItem[] }) {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ['availability-products'], queryFn: () => productApi.list({ page: 1, limit: 100, sort: 'name', order: 'asc' }) });
  const [targetKind, setTargetKind] = useState<TargetKind>('PRODUCT');
  const [targetId, setTargetId] = useState('');
  const [poolSkuId, setPoolSkuId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const pools = useQuery({ queryKey: ['inventory-pools', poolSkuId], queryFn: () => inventoryApi.listPools(poolSkuId), enabled: targetKind === 'POOL' && !!poolSkuId });
  const blocks = useQuery({ queryKey: ['inventory-blocks', page], queryFn: () => inventoryApi.listBlocks({ page, limit: 25, activeOnly: true }), placeholderData: (previous) => previous });
  const options = targetKind === 'PRODUCT' ? (productsQuery.data?.data || []).map((product) => ({ id: product.id, label: product.name })) : targetKind === 'SKU' ? skus.map((sku) => ({ id: sku.id, label: `${sku.productName} · ${sku.variantName || 'Default'} · ${sku.sizeLabel}` })) : targetKind === 'ITEM' ? items.map((item) => ({ id: item.id, label: `${item.assetCode} · ${item.variantSize.variant.product.name}` })) : targetKind === 'LOCATION' ? locations.filter((location) => location.isActive).map((location) => ({ id: location.id, label: location.name })) : (pools.data || []).map((pool) => ({ id: pool.id, label: `${pool.location.name} · ${pool.onHandQuantity} on hand` }));
  useEffect(() => { if (!options.some((option) => option.id === targetId)) setTargetId(options[0]?.id || ''); }, [options, targetId]);
  const payload = useMemo<InventoryBlockInput>(() => ({
    ...(targetKind === 'PRODUCT' ? { productId: targetId } : {}), ...(targetKind === 'SKU' ? { variantSizeId: targetId } : {}),
    ...(targetKind === 'ITEM' ? { stockUnitId: targetId } : {}), ...(targetKind === 'LOCATION' ? { locationId: targetId } : {}),
    ...(targetKind === 'POOL' ? { inventoryPoolId: targetId, ...(quantity ? { quantity: Number(quantity) } : {}) } : {}),
    startDate, endDate, reason: reason.trim(), blockType: targetKind === 'LOCATION' ? 'LOCATION_BLACKOUT' : targetKind === 'SKU' ? 'SKU_BLACKOUT' : 'MANUAL',
  }), [targetKind, targetId, quantity, startDate, endDate, reason]);
  const signature = JSON.stringify(payload);
  const preview = useMutation({ mutationFn: inventoryApi.previewBlock });
  const create = useMutation({
    mutationFn: inventoryApi.createBlock,
    onSuccess: async (result) => { setReason(''); preview.reset(); await queryClient.invalidateQueries({ queryKey: ['inventory-blocks'] }); toast.success(result.preview.affectedReservations ? 'Block created; affected bookings need attention' : 'Availability block created'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not create availability block')),
  });
  const remove = useMutation({ mutationFn: inventoryApi.deleteBlock, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['inventory-blocks'] }); toast.success('Availability block removed'); }, onError: (error) => toast.error(errorMessage(error, 'Could not remove block')) });
  const valid = !!targetId && !!startDate && !!endDate && endDate >= startDate && !!reason.trim() && (!quantity || Number(quantity) > 0);
  const previewCurrent = preview.data && JSON.stringify(preview.variables) === signature;

  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarOff className="h-4 w-4" />Create scoped blackout</CardTitle><CardDescription>Preview active rental conflicts before blocking a product, SKU, physical piece, location, or pooled quantity.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="grid gap-2"><Label>Target type</Label><Select value={targetKind} onValueChange={(value) => { setTargetKind(value as TargetKind); setTargetId(''); preview.reset(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['PRODUCT', 'SKU', 'ITEM', 'LOCATION', 'POOL'] as const).map((value) => <SelectItem key={value} value={value}>{value === 'POOL' ? 'Pooled stock quantity' : humanize(value)}</SelectItem>)}</SelectContent></Select></div>{targetKind === 'POOL' && <div className="grid gap-2"><Label>SKU</Label><Select value={poolSkuId} onValueChange={(value) => { setPoolSkuId(value); setTargetId(''); }}><SelectTrigger><SelectValue placeholder="Choose pooled SKU" /></SelectTrigger><SelectContent>{skus.filter((sku) => sku.trackingMode === 'POOLED').map((sku) => <SelectItem key={sku.id} value={sku.id}>{sku.productName} · {sku.sizeLabel}</SelectItem>)}</SelectContent></Select></div>}<div className="grid gap-2"><Label>Exact target</Label><Select value={targetId} onValueChange={(value) => { setTargetId(value); preview.reset(); }} disabled={!options.length}><SelectTrigger><SelectValue placeholder="Choose target" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>{targetKind === 'POOL' && <div className="grid gap-2"><Label>Quantity (blank = full pool)</Label><Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>}</div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Blocked from</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div className="grid gap-2"><Label>Blocked through</Label><Input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
    <div className="grid gap-2"><Label>Operational reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Private event hold, venue closure, planned stock withdrawal…" /></div>
    {previewCurrent && <div className={`rounded-lg border p-4 ${preview.data!.warning ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : ''}`}><div className="flex items-start gap-3">{preview.data!.warning && <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}<div><p className="font-medium">{preview.data!.affectedReservations} reservation(s), {preview.data!.affectedQuantity} piece(s) overlap</p><p className="text-sm text-muted-foreground">{preview.data!.warning || 'No active rental commitment conflicts with this block.'}</p>{preview.data!.affectedBookings.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{preview.data!.affectedBookings.map((booking) => <Button key={booking.id} size="sm" variant="outline" asChild><Link href={`/dashboard/bookings/${booking.id}`}>{booking.bookingNumber}</Link></Button>)}</div>}</div></div></div>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!valid || preview.isPending} onClick={() => preview.mutate(payload)}>{preview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preview conflicts</Button><Button disabled={!previewCurrent || create.isPending} onClick={() => create.mutate(payload)}>Create block</Button></div>
  </CardContent></Card>
  {blocks.isLoading ? <OwnerTableSkeleton columns={4} /> : blocks.isError ? <OwnerListError message="Availability blocks could not be loaded." onRetry={() => void blocks.refetch()} /> : !blocks.data?.data.length ? <OwnerListEmpty title="No active availability blocks" description="Manual and workflow-owned blocks will appear here." icon={<CalendarOff />} /> : <Card><CardHeader><CardTitle className="text-base">Active blocks</CardTitle></CardHeader><CardContent className="space-y-3">{blocks.data.data.map((block) => <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{blockTarget(block)}</p><Badge variant="outline">{humanize(block.blockType)}</Badge>{block.quantity && <Badge variant="secondary">{block.quantity} piece(s)</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{block.startDate.slice(0, 10)} → {block.endDate.slice(0, 10)} · {block.reason}</p><p className="text-xs text-muted-foreground">Owner: {humanize(block.owner)}{block.createdByUser ? ` · ${block.createdByUser.fullName}` : ''}</p></div>{block.canDelete ? <Button size="icon" variant="ghost" aria-label="Remove block" disabled={remove.isPending} onClick={() => remove.mutate(block.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : <Badge variant="secondary">Managed by workflow</Badge>}</div>)}<OwnerListPagination page={blocks.data.meta.page} totalPages={blocks.data.meta.totalPages} total={blocks.data.meta.total} pageSize={blocks.data.meta.limit} isPending={blocks.isFetching} onPageChange={setPage} /></CardContent></Card>}
  </div>;
}

function blockTarget(block: Awaited<ReturnType<typeof inventoryApi.listBlocks>>['data'][number]) {
  if (block.product) return block.product.name;
  if (block.variant) return `${block.variant.product.name} · ${block.variant.variantName || 'Default'}`;
  if (block.variantSize) return `${block.variantSize.variant.product.name} · ${block.variantSize.variant.variantName || 'Default'} · ${block.variantSize.sizeInstance.displayLabel}`;
  if (block.stockUnit) return `${block.stockUnit.assetCode} · ${block.stockUnit.variantSize.variant.product.name}`;
  if (block.location) return block.location.name;
  if (block.inventoryPool) return `${block.inventoryPool.variantSize.variant.product.name} · ${block.inventoryPool.variantSize.sizeInstance.displayLabel} · ${block.inventoryPool.location.name}`;
  return 'Inventory block';
}

export default function InventoryAvailabilityPage() {
  const locations = useQuery({ queryKey: ['inventory-locations', 'all'], queryFn: () => inventoryApi.listLocations(true) });
  const skus = useQuery({ queryKey: ['inventory-skus', 'availability'], queryFn: () => inventoryApi.listSkus({ page: 1, limit: 100, sort: 'PRODUCT', order: 'asc' }) });
  const items = useQuery({ queryKey: ['inventory-items', 'availability'], queryFn: () => inventoryApi.listItems({ page: 1, limit: 100 }) });
  const loading = locations.isLoading || skus.isLoading || items.isLoading;
  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading availability controls…</div>;
  return <div className="space-y-6 pb-10"><div><h1 className="text-2xl font-semibold tracking-tight">Availability control</h1><p className="text-sm text-muted-foreground">Manage inherited rental buffers, eligibility, operational blackouts, and affected-booking previews.</p></div><Tabs defaultValue="policies"><TabsList><TabsTrigger value="policies">Policies</TabsTrigger><TabsTrigger value="blocks">Blocks & blackouts</TabsTrigger></TabsList><TabsContent value="policies" className="mt-5"><PolicyWorkspace locations={locations.data || []} skus={skus.data?.data || []} /></TabsContent><TabsContent value="blocks" className="mt-5"><BlockWorkspace locations={locations.data || []} skus={skus.data?.data || []} items={items.data?.data || []} /></TabsContent></Tabs></div>;
}
