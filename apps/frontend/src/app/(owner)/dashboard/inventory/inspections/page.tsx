'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import {
  inventoryOperationsApi,
  type InspectionQueueRecord,
  type IssueQueueRecord,
  type StockUnitInspectionDecision,
  type StockUnitInspectionStatus,
  type StockUnitInspectionType,
  type StockUnitIssueResponsibility,
  type StockUnitIssueSeverity,
  type StockUnitIssueStatus,
} from '@/lib/api/inventory-operations';
import { inventoryApi } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OwnerListEmpty, OwnerListError, OwnerListPagination, OwnerTableSkeleton } from '@/components/owner/workspace';

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const inspectionStatuses: StockUnitInspectionStatus[] = ['DRAFT', 'COMPLETED', 'SUPERSEDED'];
const inspectionTypes: StockUnitInspectionType[] = ['PRE_RENTAL', 'RETURN', 'PERIODIC', 'SERVICE_COMPLETION'];
const decisions: StockUnitInspectionDecision[] = ['AVAILABLE', 'CLEANING', 'WASHING', 'REPAIR', 'QUARANTINE', 'LOST', 'RETIRE'];
const issueStatuses: StockUnitIssueStatus[] = ['OPEN', 'IN_SERVICE', 'RESOLVED', 'WAIVED'];
const severities: StockUnitIssueSeverity[] = ['INFO', 'MINOR', 'MODERATE', 'SEVERE', 'CRITICAL'];
const responsibilities: StockUnitIssueResponsibility[] = ['UNKNOWN', 'CUSTOMER', 'BUSINESS', 'NORMAL_WEAR', 'THIRD_PARTY'];

export default function InventoryInspectionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = params.get('kind') === 'ISSUE' ? 'ISSUE' : 'INSPECTION';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? (kind === 'INSPECTION' ? 'DRAFT' : 'OPEN');
  const value = (key: string) => params.get(key) ?? '';
  const locationId = value('locationId');
  const productId = value('productId');
  const variantSizeId = value('variantSizeId');
  const stockUnitId = value('stockUnitId');
  const inspectionType = value('inspectionType');
  const decision = value('decision');
  const severity = value('severity');
  const responsibility = value('responsibility');
  const bookingId = value('bookingId');
  const dateFrom = value('dateFrom');
  const dateTo = value('dateTo');

  const locations = useQuery({ queryKey: ['inventory-locations'], queryFn: () => inventoryApi.listLocations(true) });
  const skus = useQuery({ queryKey: ['inventory-skus', 'attention-filter'], queryFn: () => inventoryApi.listSkus({ page: 1, limit: 100 }) });
  const items = useQuery({ queryKey: ['inventory-items', 'attention-filter'], queryFn: () => inventoryApi.listItems({ page: 1, limit: 100 }) });
  const products = [...new Map((skus.data?.data || []).map((sku) => [sku.productId, { id: sku.productId, name: sku.productName }])).values()];
  const queue = useQuery({
    queryKey: ['inventory-attention', kind, page, status, locationId, productId, variantSizeId, stockUnitId, inspectionType, decision, severity, responsibility, bookingId, dateFrom, dateTo],
    queryFn: () => inventoryOperationsApi.listAttention({
      kind, page, limit: 25,
      ...(kind === 'INSPECTION' ? { inspectionStatus: status as StockUnitInspectionStatus } : { issueStatus: status as StockUnitIssueStatus }),
      ...(locationId ? { locationId } : {}), ...(productId ? { productId } : {}),
      ...(variantSizeId ? { variantSizeId } : {}), ...(stockUnitId ? { stockUnitId } : {}),
      ...(inspectionType ? { inspectionType: inspectionType as StockUnitInspectionType } : {}),
      ...(decision ? { decision: decision as StockUnitInspectionDecision } : {}),
      ...(severity ? { severity: severity as StockUnitIssueSeverity } : {}),
      ...(responsibility ? { responsibility: responsibility as StockUnitIssueResponsibility } : {}),
      ...(bookingId ? { bookingId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}),
    }),
    placeholderData: (previous) => previous,
  });
  const update = (changes: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, nextValue] of Object.entries(changes)) {
      if (nextValue) next.set(key, nextValue);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    const href = `${pathname}${next.size ? `?${next}` : ''}`;
    if (push) router.push(href);
    else router.replace(href);
  };

  return <div className="space-y-6 pb-10">
    <div><h1 className="text-2xl font-semibold tracking-tight">Inspections & condition issues</h1><p className="text-sm text-muted-foreground">Returned pieces, component checks, damage, missing parts, responsibility, and the next valid action.</p></div>
    <Card><CardContent className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect value={kind} allLabel="Queue" options={['INSPECTION', 'ISSUE']} onChange={(next) => update({ kind: next, status: next === 'ISSUE' ? 'OPEN' : 'DRAFT', severity: null, responsibility: null, inspectionType: null, decision: null })} allowAll={false} />
        <FilterSelect value={status} allLabel="All statuses" options={kind === 'INSPECTION' ? inspectionStatuses : issueStatuses} onChange={(next) => update({ status: next || null })} />
        <FilterSelect value={locationId} allLabel="All locations" options={(locations.data || []).map((location) => ({ value: location.id, label: location.name }))} onChange={(next) => update({ locationId: next || null })} />
        {kind === 'INSPECTION' ? <FilterSelect value={inspectionType} allLabel="All inspection types" options={inspectionTypes} onChange={(next) => update({ inspectionType: next || null })} /> : <FilterSelect value={severity} allLabel="All severities" options={severities} onChange={(next) => update({ severity: next || null })} />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kind === 'INSPECTION' ? <FilterSelect value={decision} allLabel="Any decision" options={decisions} onChange={(next) => update({ decision: next || null })} /> : <FilterSelect value={responsibility} allLabel="Any responsibility" options={responsibilities} onChange={(next) => update({ responsibility: next || null })} />}
        <FilterSelect value={productId} allLabel="All products" options={products.map((product) => ({ value: product.id, label: product.name }))} onChange={(next) => update({ productId: next || null, variantSizeId: null, stockUnitId: null })} />
        <FilterSelect value={variantSizeId} allLabel="All SKUs" options={(skus.data?.data || []).filter((sku) => !productId || sku.productId === productId).map((sku) => ({ value: sku.id, label: `${sku.productName} · ${sku.variantName || 'Default'} · ${sku.sizeLabel}` }))} onChange={(next) => update({ variantSizeId: next || null, stockUnitId: null })} />
        <FilterSelect value={stockUnitId} allLabel="All physical items" options={(items.data?.data || []).filter((item) => (!productId || item.variantSize.variant.product.id === productId) && (!variantSizeId || item.variantSize.id === variantSizeId)).map((item) => ({ value: item.id, label: `${item.assetCode} · ${item.variantSize.variant.product.name}` }))} onChange={(next) => update({ stockUnitId: next || null })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><Input type="date" aria-label="Created from" value={dateFrom} onChange={(event) => update({ dateFrom: event.target.value || null })} /><Input type="date" aria-label="Created through" min={dateFrom} value={dateTo} onChange={(event) => update({ dateTo: event.target.value || null })} /><Input key={`booking-${bookingId}`} aria-label="Booking ID" placeholder="Booking ID (from a booking link)" defaultValue={bookingId} onBlur={(event) => update({ bookingId: event.target.value.trim() || null })} /></div>
    </CardContent></Card>
    {queue.isLoading ? <OwnerTableSkeleton columns={5} /> : queue.isError ? <OwnerListError message="Inventory attention could not be loaded." onRetry={() => void queue.refetch()} /> : !queue.data?.data.length ? <OwnerListEmpty title={kind === 'ISSUE' ? 'No issues in this queue' : 'No inspections in this queue'} description="Change the filters or continue normal inventory operations." icon={kind === 'ISSUE' ? <AlertTriangle /> : <ClipboardCheck />} /> : <Card className="overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Physical item</TableHead><TableHead>Attention</TableHead><TableHead>State</TableHead><TableHead>Context</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{queue.data.data.map((record) => { const inspection = 'inspectionType' in record ? record as InspectionQueueRecord : null; const issue = inspection ? null : record as IssueQueueRecord; const unit = record.stockUnit; const itemHref = `/dashboard/products/${unit.variantSize.variant.product.id}/inventory/${unit.id}`; return <TableRow key={record.id}><TableCell><p className="font-medium">{unit.variantSize.variant.product.name}</p><p className="text-xs text-muted-foreground">{unit.assetCode} · {unit.location.name}</p></TableCell><TableCell>{inspection ? humanize(inspection.inspectionType) : issue?.issueType}</TableCell><TableCell><Badge variant={issue && ['SEVERE', 'CRITICAL'].includes(issue.severity) ? 'destructive' : 'outline'}>{inspection ? humanize(inspection.status) : humanize(issue!.severity)}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{inspection?.bookingItem?.booking.bookingNumber ?? issue?.bookingItem?.booking.bookingNumber ?? (issue?.responsibility ? humanize(issue.responsibility) : 'Internal')}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" asChild><Link href={itemHref}>{inspection?.status === 'DRAFT' ? 'Complete inspection' : issue && ['OPEN', 'IN_SERVICE'].includes(issue.status) ? 'Resolve issue' : 'View record'}</Link></Button></TableCell></TableRow>; })}</TableBody></Table></div><OwnerListPagination page={queue.data.meta.page} totalPages={queue.data.meta.totalPages} total={queue.data.meta.total} pageSize={queue.data.meta.limit} isPending={queue.isFetching} onPageChange={(nextPage) => update({ page: String(nextPage) }, true)} /></CardContent></Card>}
  </div>;
}

function FilterSelect({ value, allLabel, options, onChange, allowAll = true }: { value: string; allLabel: string; options: readonly string[] | Array<{ value: string; label: string }>; onChange: (value: string) => void; allowAll?: boolean }) {
  const normalized = options.map((option) => typeof option === 'string' ? { value: option, label: humanize(option) } : option);
  return <Select value={value || (allowAll ? 'all' : normalized[0]?.value)} onValueChange={(next) => onChange(next === 'all' ? '' : next)}><SelectTrigger><SelectValue placeholder={allLabel} /></SelectTrigger><SelectContent>{allowAll && <SelectItem value="all">{allLabel}</SelectItem>}{normalized.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
