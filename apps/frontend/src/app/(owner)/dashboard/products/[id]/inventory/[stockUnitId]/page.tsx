'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  History,
  Loader2,
  PackageCheck,
  Plus,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  inventoryOperationsApi,
  type CompleteInspectionInput,
  type InspectionCheckResult,
  type InventoryServiceOrder,
  type InventoryServiceOrderType,
  type SetComponentDefinition,
  type StockConditionGrade,
  type StockUnitComponentPresence,
  type StockUnitDisposition,
  type StockUnitInspection,
  type StockUnitInspectionDecision,
  type StockUnitInspectionType,
  type StockUnitIssue,
  type StockUnitIssueResponsibility,
  type StockUnitIssueSeverity,
  type StockUnitOperationalState,
  type StockUnitOperations,
} from '@/lib/api/inventory-operations';

const CONDITIONS: StockConditionGrade[] = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const INSPECTION_TYPES: StockUnitInspectionType[] = ['PRE_RENTAL', 'RETURN', 'PERIODIC', 'SERVICE_COMPLETION'];
const DECISIONS: StockUnitInspectionDecision[] = ['AVAILABLE', 'CLEANING', 'WASHING', 'REPAIR', 'QUARANTINE', 'LOST', 'RETIRE'];
const SERVICE_TYPES: InventoryServiceOrderType[] = ['PREPARATION', 'CLEANING', 'WASHING', 'REPAIR', 'ALTERATION', 'MAINTENANCE'];
const PRESENCE_OPTIONS: StockUnitComponentPresence[] = ['PRESENT', 'MISSING', 'DAMAGED', 'NOT_APPLICABLE'];
const OPERATIONAL_TRANSITIONS: Record<StockUnitOperationalState, StockUnitOperationalState[]> = {
  AVAILABLE: ['PREPARING', 'AWAITING_INSPECTION', 'CLEANING', 'WASHING', 'REPAIRING', 'IN_TRANSFER'],
  PREPARING: ['READY', 'AVAILABLE', 'AWAITING_INSPECTION'],
  READY: ['OUT_FOR_RENTAL', 'AVAILABLE', 'AWAITING_INSPECTION'],
  OUT_FOR_RENTAL: ['AWAITING_INSPECTION'],
  AWAITING_INSPECTION: ['AVAILABLE', 'CLEANING', 'WASHING', 'REPAIRING'],
  CLEANING: ['AWAITING_INSPECTION', 'AVAILABLE'],
  WASHING: ['AWAITING_INSPECTION', 'AVAILABLE'],
  REPAIRING: ['AWAITING_INSPECTION'],
  IN_TRANSFER: ['AVAILABLE', 'AWAITING_INSPECTION'],
};
const DISPOSITION_TRANSITIONS: Record<StockUnitDisposition, StockUnitDisposition[]> = {
  ACTIVE: ['QUARANTINED', 'LOST', 'RETIRED'],
  QUARANTINED: ['LOST', 'RETIRED'],
  LOST: ['RETIRED'],
  RETIRED: [],
};

function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

function apiErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | { message?: string }; error?: { message?: string } } } })?.response?.data;
  if (typeof message?.message === 'string') return message.message;
  if (typeof message?.message === 'object') return message.message.message || fallback;
  return message?.error?.message || fallback;
}

function commandKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function availabilityVariant(unit: StockUnitOperations['stockUnit']) {
  if (unit.disposition === 'LOST' || unit.disposition === 'RETIRED') return 'destructive' as const;
  if (unit.disposition === 'QUARANTINED' || unit.operationalState !== 'AVAILABLE') return 'secondary' as const;
  return 'default' as const;
}

function LifecyclePanel({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  const unit = data.stockUnit;
  const [state, setState] = useState<StockUnitOperationalState | ''>('');
  const [stateReason, setStateReason] = useState('');
  const [disposition, setDisposition] = useState<StockUnitDisposition | ''>('');
  const [dispositionReason, setDispositionReason] = useState('');
  const transition = useMutation({
    mutationFn: () => inventoryOperationsApi.transition(unit.id, { targetState: state as StockUnitOperationalState, reason: stateReason, idempotencyKey: commandKey('unit-state') }),
    onSuccess: async () => { setState(''); setStateReason(''); await refresh(); toast.success('Operational state updated'); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update operational state')),
  });
  const changeDisposition = useMutation({
    mutationFn: () => inventoryOperationsApi.changeDisposition(unit.id, { targetDisposition: disposition as StockUnitDisposition, reason: dispositionReason, idempotencyKey: commandKey('unit-disposition') }),
    onSuccess: async () => { setDisposition(''); setDispositionReason(''); await refresh(); toast.success('Unit disposition updated'); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update disposition')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Operational state</CardTitle><CardDescription>Where the item is in its current rental or care workflow.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="outline">Current: {label(unit.operationalState)}</Badge>
          {OPERATIONAL_TRANSITIONS[unit.operationalState].length ? <>
            <Select value={state} onValueChange={(value) => setState(value as StockUnitOperationalState)}><SelectTrigger><SelectValue placeholder="Move to…" /></SelectTrigger><SelectContent>{OPERATIONAL_TRANSITIONS[unit.operationalState].map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select>
            <Textarea value={stateReason} onChange={(event) => setStateReason(event.target.value)} placeholder="Why is this state changing?" />
            <Button disabled={!state || !stateReason.trim() || transition.isPending} onClick={() => transition.mutate()}>{transition.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply state</Button>
          </> : <p className="text-sm text-muted-foreground">No operational transitions are allowed from this state.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Asset disposition</CardTitle><CardDescription>Administrative availability: active, quarantined, lost, or retired.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Badge variant={availabilityVariant(unit)}>Current: {label(unit.disposition)}</Badge>
          {DISPOSITION_TRANSITIONS[unit.disposition].length ? <>
            <Select value={disposition} onValueChange={(value) => setDisposition(value as StockUnitDisposition)}><SelectTrigger><SelectValue placeholder="Change disposition…" /></SelectTrigger><SelectContent>{DISPOSITION_TRANSITIONS[unit.disposition].map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select>
            <Textarea value={dispositionReason} onChange={(event) => setDispositionReason(event.target.value)} placeholder="Required audit reason" />
            <Button variant={disposition === 'LOST' || disposition === 'RETIRED' ? 'destructive' : 'default'} disabled={!disposition || !dispositionReason.trim() || changeDisposition.isPending} onClick={() => changeDisposition.mutate()}>{changeDisposition.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply disposition</Button>
          </> : <p className="text-sm text-muted-foreground">{unit.disposition === 'RETIRED' ? 'Retirement is final. The unit history remains available for audit.' : 'Create and complete an inspection with an Available decision to reactivate this item.'}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateInspectionDialog({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [inspectionType, setInspectionType] = useState<StockUnitInspectionType>('PERIODIC');
  const [assignmentId, setAssignmentId] = useState('');
  const [serviceOrderId, setServiceOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const requiresAssignment = inspectionType === 'PRE_RENTAL' || inspectionType === 'RETURN';
  const completedServices = data.serviceOrders.filter((order) => order.status === 'COMPLETED');
  const create = useMutation({
    mutationFn: () => inventoryOperationsApi.createInspection(data.stockUnit.id, {
      inspectionType,
      assignmentId: requiresAssignment ? assignmentId : undefined,
      serviceOrderId: inspectionType === 'SERVICE_COMPLETION' ? serviceOrderId : undefined,
      notes: notes.trim() || undefined,
      idempotencyKey: commandKey('inspection-create'),
    }),
    onSuccess: async () => { setOpen(false); setAssignmentId(''); setServiceOrderId(''); setNotes(''); await refresh(); toast.success('Inspection draft created'); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not create inspection')),
  });
  const contextValid = !requiresAssignment || assignmentId;
  const serviceValid = inspectionType !== 'SERVICE_COMPLETION' || serviceOrderId;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New inspection</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Start item inspection</DialogTitle><DialogDescription>The draft blocks return and periodic workflows until a decision is recorded.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2"><Label>Inspection type</Label><Select value={inspectionType} onValueChange={(value) => setInspectionType(value as StockUnitInspectionType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INSPECTION_TYPES.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div>
        {requiresAssignment && <div className="grid gap-2"><Label>Rental assignment</Label><Select value={assignmentId} onValueChange={setAssignmentId}><SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger><SelectContent>{data.stockUnit.assignments.map((item) => <SelectItem key={item.id} value={item.id}>Booking {item.reservation.bookingId.slice(0, 8)} · {item.blockedStartDate.slice(0, 10)} to {item.blockedEndDate.slice(0, 10)}</SelectItem>)}</SelectContent></Select>{!data.stockUnit.assignments.length && <p className="text-xs text-destructive">No active assignment exists for this physical piece.</p>}</div>}
        {inspectionType === 'SERVICE_COMPLETION' && <div className="grid gap-2"><Label>Completed service work</Label><Select value={serviceOrderId} onValueChange={setServiceOrderId}><SelectTrigger><SelectValue placeholder="Select service order" /></SelectTrigger><SelectContent>{completedServices.map((item) => <SelectItem key={item.id} value={item.id}>{label(item.serviceType)} · {item.completedAt?.slice(0, 10)}</SelectItem>)}</SelectContent></Select>{!completedServices.length && <p className="text-xs text-destructive">No completed service order is awaiting inspection.</p>}</div>}
        <div className="grid gap-2"><Label>Opening notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What should the inspector verify?" /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!contextValid || !serviceValid || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create draft</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

interface CheckDraft { result: InspectionCheckResult; observedQuantity: number; notes: string }

function CompleteInspectionDialog({ inspection, definitions, stockUnitId, refresh }: { inspection: StockUnitInspection; definitions: SetComponentDefinition[]; stockUnitId: string; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [conditionAfter, setConditionAfter] = useState<StockConditionGrade>(inspection.conditionBefore);
  const [decision, setDecision] = useState<StockUnitInspectionDecision>('AVAILABLE');
  const [notes, setNotes] = useState(inspection.notes || '');
  const [liabilityNote, setLiabilityNote] = useState('');
  const [checks, setChecks] = useState<Record<string, CheckDraft>>(() => Object.fromEntries(definitions.map((item) => [item.id, { result: 'PASS', observedQuantity: item.requiredQuantity, notes: '' }])));
  const [recordIssue, setRecordIssue] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [severity, setSeverity] = useState<StockUnitIssueSeverity>('MINOR');
  const [responsibility, setResponsibility] = useState<StockUnitIssueResponsibility>('UNKNOWN');
  const [issueDescription, setIssueDescription] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const complete = useMutation({
    mutationFn: async () => {
      const mediaFiles = files.length ? await inventoryOperationsApi.uploadInspectionMedia(stockUnitId, files) : [];
      const payload: CompleteInspectionInput = {
        conditionAfter,
        decision,
        notes: notes.trim() || undefined,
        customerLiabilityNote: liabilityNote.trim() || undefined,
        checks: definitions.map((definition) => ({
          setComponentDefinitionId: definition.id,
          label: definition.name,
          expectedQuantity: definition.requiredQuantity,
          observedQuantity: checks[definition.id]?.observedQuantity ?? definition.requiredQuantity,
          result: checks[definition.id]?.result ?? 'PASS',
          notes: checks[definition.id]?.notes || undefined,
        })),
        issues: recordIssue ? [{ issueType, severity, responsibility, description: issueDescription, isAvailabilityBlocking: blocking }] : undefined,
        media: mediaFiles.map((file) => ({ ...file, purpose: inspection.inspectionType === 'RETURN' ? 'POST_RETURN' : 'PRE_RENTAL' })),
        idempotencyKey: commandKey('inspection-complete'),
      };
      return inventoryOperationsApi.completeInspection(inspection.id, payload);
    },
    onSuccess: async () => { setOpen(false); await refresh(); toast.success('Inspection completed and lifecycle updated'); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not complete inspection')),
  });
  const validIssue = !recordIssue || (issueType.trim() && issueDescription.trim());

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm">Complete inspection</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Complete {label(inspection.inspectionType)} inspection</DialogTitle><DialogDescription>Record observed condition, set completeness, evidence, and the next operational decision.</DialogDescription></DialogHeader>
      <div className="grid gap-5 py-2">
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Condition after</Label><Select value={conditionAfter} onValueChange={(value) => setConditionAfter(value as StockConditionGrade)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONDITIONS.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Decision</Label><Select value={decision} onValueChange={(value) => setDecision(value as StockUnitInspectionDecision)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DECISIONS.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div></div>
        {definitions.length > 0 && <div className="space-y-3"><Label>Required set checklist</Label>{definitions.map((definition) => { const value = checks[definition.id] || { result: 'PASS' as const, observedQuantity: definition.requiredQuantity, notes: '' }; return <div key={definition.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_120px_170px]"><div><p className="text-sm font-medium">{definition.name} × {definition.requiredQuantity}</p><p className="text-xs text-muted-foreground">{definition.inspectionGuidance || (definition.absenceBlocksRental ? 'Required for rental' : 'Optional component')}</p></div><Input aria-label={`${definition.name} observed quantity`} type="number" min={0} value={value.observedQuantity} onChange={(event) => setChecks((current) => ({ ...current, [definition.id]: { ...value, observedQuantity: Math.max(0, Number(event.target.value) || 0) } }))} /><Select value={value.result} onValueChange={(result) => setChecks((current) => ({ ...current, [definition.id]: { ...value, result: result as InspectionCheckResult } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PASS">Pass</SelectItem><SelectItem value="FAIL">Fail</SelectItem><SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem></SelectContent></Select></div>; })}</div>}
        <div className="grid gap-2"><Label>Inspection notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        <div className="grid gap-2"><Label>Customer liability note (internal)</Label><Textarea value={liabilityNote} onChange={(event) => setLiabilityNote(event.target.value)} placeholder="How customer responsibility was assessed" /></div>
        <div className="grid gap-2"><Label htmlFor={`inspection-media-${inspection.id}`}>Private evidence photos</Label><Input id={`inspection-media-${inspection.id}`} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))} /><p className="text-xs text-muted-foreground">Up to 10 images. Stored privately and linked to this inspection.</p></div>
        <div className="space-y-3 rounded-md border p-3"><div className="flex items-center gap-2"><Checkbox id={`record-issue-${inspection.id}`} checked={recordIssue} onCheckedChange={(checked) => setRecordIssue(checked === true)} /><Label htmlFor={`record-issue-${inspection.id}`}>Record an issue found during inspection</Label></div>{recordIssue && <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Issue type</Label><Input value={issueType} onChange={(event) => setIssueType(event.target.value)} placeholder="Stain, tear, missing accessory…" /></div><div className="grid gap-2"><Label>Severity</Label><Select value={severity} onValueChange={(value) => setSeverity(value as StockUnitIssueSeverity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL'] as StockUnitIssueSeverity[]).map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Responsibility</Label><Select value={responsibility} onValueChange={(value) => setResponsibility(value as StockUnitIssueResponsibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['CUSTOMER', 'BUSINESS', 'NORMAL_WEAR', 'UNKNOWN'] as StockUnitIssueResponsibility[]).map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end gap-2 pb-2"><Checkbox id={`blocking-${inspection.id}`} checked={blocking} onCheckedChange={(checked) => setBlocking(checked === true)} /><Label htmlFor={`blocking-${inspection.id}`}>Blocks future rental</Label></div><div className="grid gap-2 sm:col-span-2"><Label>Description</Label><Textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} /></div></div>}</div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!validIssue || complete.isPending} onClick={() => complete.mutate()}>{complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete and apply decision</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function InspectionsPanel({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">Inspections</h2><p className="text-sm text-muted-foreground">Immutable condition records; corrections are preserved as amendments.</p></div><CreateInspectionDialog data={data} refresh={refresh} /></div>
    {!data.inspections.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No inspections recorded.</CardContent></Card> : data.inspections.map((inspection) => <Card key={inspection.id}><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{label(inspection.inspectionType)}</CardTitle><CardDescription>{formatDate(inspection.createdAt)} · {inspection.inspectedBy.fullName}</CardDescription></div><div className="flex gap-2"><Badge variant={inspection.status === 'DRAFT' ? 'secondary' : 'outline'}>{label(inspection.status)}</Badge>{inspection.decision && <Badge>{label(inspection.decision)}</Badge>}</div></div></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 text-sm sm:grid-cols-3"><p>Before: <strong>{label(inspection.conditionBefore)}</strong></p><p>After: <strong>{inspection.conditionAfter ? label(inspection.conditionAfter) : 'Pending'}</strong></p><p>Checks: <strong>{inspection.checks.length}</strong></p></div>{inspection.notes && <p className="text-sm text-muted-foreground">{inspection.notes}</p>}{inspection.status === 'DRAFT' && <CompleteInspectionDialog inspection={inspection} definitions={data.stockUnit.variantSize.setComponentDefinitions} stockUnitId={data.stockUnit.id} refresh={refresh} />}</CardContent></Card>)}
  </div>;
}

function ResolveIssueDialog({ issue, refresh }: { issue: StockUnitIssue; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [waive, setWaive] = useState(false);
  const resolve = useMutation({ mutationFn: () => inventoryOperationsApi.resolveIssue(issue.id, { resolutionNotes: notes, waive, idempotencyKey: commandKey('issue-resolve') }), onSuccess: async () => { setOpen(false); await refresh(); toast.success(waive ? 'Issue waived' : 'Issue resolved'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not resolve issue')) });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Resolve</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Close issue</DialogTitle><DialogDescription>Service work linked to this issue must be completed first.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Resolution details" /><div className="flex items-center gap-2"><Checkbox id={`waive-${issue.id}`} checked={waive} onCheckedChange={(checked) => setWaive(checked === true)} /><Label htmlFor={`waive-${issue.id}`}>Waive instead of resolve</Label></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!notes.trim() || resolve.isPending} onClick={() => resolve.mutate()}>Close issue</Button></DialogFooter></DialogContent></Dialog>;
}

function IssuesPanel({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  return <div className="space-y-3">{!data.issues.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No condition or loss issues recorded.</CardContent></Card> : data.issues.map((issue) => <Card key={issue.id}><CardContent className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="space-y-2"><div className="flex flex-wrap gap-2"><Badge variant={issue.isAvailabilityBlocking ? 'destructive' : 'secondary'}>{label(issue.severity)}</Badge><Badge variant="outline">{label(issue.status)}</Badge><Badge variant="outline">{label(issue.responsibility)}</Badge></div><div><p className="font-medium">{issue.issueType}</p><p className="max-w-2xl text-sm text-muted-foreground">{issue.description}</p></div><p className="text-xs text-muted-foreground">Reported {formatDate(issue.createdAt)}{issue.reportedBy ? ` by ${issue.reportedBy.fullName}` : ''}</p>{issue.resolutionNotes && <p className="text-sm">Resolution: {issue.resolutionNotes}</p>}</div>{(issue.status === 'OPEN' || issue.status === 'IN_SERVICE') && <ResolveIssueDialog issue={issue} refresh={refresh} />}</CardContent></Card>)}</div>;
}

function CreateServiceDialog({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [serviceType, setServiceType] = useState<InventoryServiceOrderType>('CLEANING');
  const [issueId, setIssueId] = useState('none');
  const [providerName, setProviderName] = useState('');
  const [expectedCompletionAt, setExpectedCompletionAt] = useState('');
  const [notes, setNotes] = useState('');
  const create = useMutation({ mutationFn: () => inventoryOperationsApi.createServiceOrder(data.stockUnit.id, { serviceType, issueId: issueId === 'none' ? undefined : issueId, providerName: providerName.trim() || undefined, expectedCompletionAt: expectedCompletionAt || undefined, notes: notes.trim() || undefined, isAvailabilityBlocking: true, idempotencyKey: commandKey('service-create') }), onSuccess: async () => { setOpen(false); await refresh(); toast.success('Service order created'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not create service order')) });
  const openIssues = data.issues.filter((issue) => issue.status === 'OPEN');
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New service order</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Schedule item care</DialogTitle><DialogDescription>The item is blocked from availability while blocking service work is active.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Service type</Label><Select value={serviceType} onValueChange={(value) => setServiceType(value as InventoryServiceOrderType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERVICE_TYPES.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Linked issue</Label><Select value={issueId} onValueChange={setIssueId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No linked issue</SelectItem>{openIssues.map((item) => <SelectItem key={item.id} value={item.id}>{item.issueType} · {label(item.severity)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Provider</Label><Input value={providerName} onChange={(event) => setProviderName(event.target.value)} /></div><div className="grid gap-2"><Label>Expected completion</Label><Input type="datetime-local" value={expectedCompletionAt} onChange={(event) => setExpectedCompletionAt(event.target.value)} /></div></div><div className="grid gap-2"><Label>Instructions</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={create.isPending} onClick={() => create.mutate()}>Create service order</Button></DialogFooter></DialogContent></Dialog>;
}

function CompleteServiceDialog({ order, refresh }: { order: InventoryServiceOrder; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [requiresInspection, setRequiresInspection] = useState(true);
  const canSkipInspection = ['PREPARATION', 'CLEANING', 'WASHING'].includes(order.serviceType);
  const complete = useMutation({ mutationFn: () => inventoryOperationsApi.completeServiceOrder(order.id, { completionOutcome: outcome, requiresInspection: canSkipInspection ? requiresInspection : true, idempotencyKey: commandKey('service-complete') }), onSuccess: async () => { setOpen(false); await refresh(); toast.success('Service work completed'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not complete service work')) });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm">Complete</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Complete service work</DialogTitle><DialogDescription>{canSkipInspection ? 'You may return routine care directly to availability, or require a verification inspection.' : 'Repair, alteration, and maintenance always require a completion inspection.'}</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Work completed and observed outcome" />{canSkipInspection && <div className="flex items-center gap-2"><Checkbox id={`requires-inspection-${order.id}`} checked={requiresInspection} onCheckedChange={(checked) => setRequiresInspection(checked === true)} /><Label htmlFor={`requires-inspection-${order.id}`}>Require completion inspection before availability</Label></div>}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!outcome.trim() || complete.isPending} onClick={() => complete.mutate()}>Complete work</Button></DialogFooter></DialogContent></Dialog>;
}

function CancelServiceDialog({ order, refresh }: { order: InventoryServiceOrder; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const cancel = useMutation({
    mutationFn: () => inventoryOperationsApi.cancelServiceOrder(order.id, { reason, idempotencyKey: commandKey('service-cancel') }),
    onSuccess: async () => { setOpen(false); await refresh(); toast.success('Service order cancelled'); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not cancel service work')),
  });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Cancel</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cancel service order</DialogTitle><DialogDescription>If work already started, the item will require inspection before it can become available.</DialogDescription></DialogHeader><div className="grid gap-2 py-2"><Label>Cancellation reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Keep order</Button><Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>Cancel order</Button></DialogFooter></DialogContent></Dialog>;
}

function ServicePanel({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  const start = useMutation({ mutationFn: (orderId: string) => inventoryOperationsApi.startServiceOrder(orderId, { idempotencyKey: commandKey('service-start') }), onSuccess: async () => { await refresh(); toast.success('Service work started'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not start service work')) });
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">Cleaning, repair, and preparation</h2><p className="text-sm text-muted-foreground">Each order owns its availability block and completion policy.</p></div><CreateServiceDialog data={data} refresh={refresh} /></div>{!data.serviceOrders.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No service work recorded.</CardContent></Card> : data.serviceOrders.map((order) => { const active = ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(order.status); return <Card key={order.id}><CardContent className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="space-y-2"><div className="flex gap-2"><Badge>{label(order.serviceType)}</Badge><Badge variant="outline">{label(order.status)}</Badge>{order.isAvailabilityBlocking && active && <Badge variant="destructive">Blocks rental</Badge>}</div><p className="text-sm text-muted-foreground">Requested {formatDate(order.requestedAt)}{order.providerName ? ` · ${order.providerName}` : ''}</p>{order.notes && <p className="whitespace-pre-line text-sm">{order.notes}</p>}{order.completionOutcome && <p className="text-sm">Outcome: {order.completionOutcome}</p>}</div><div className="flex gap-2">{(order.status === 'REQUESTED' || order.status === 'SCHEDULED') && <Button size="sm" variant="outline" disabled={start.isPending} onClick={() => start.mutate(order.id)}>Start</Button>}{active && <CompleteServiceDialog order={order} refresh={refresh} />}{active && <CancelServiceDialog order={order} refresh={refresh} />}</div></CardContent></Card>; })}</div>;
}

function ComponentStateRow({ definition, state, stockUnitId, refresh, remove }: { definition: SetComponentDefinition; state: StockUnitOperations['stockUnit']['componentStates'][number] | undefined; stockUnitId: string; refresh: () => Promise<void>; remove: () => void }) {
  const [presence, setPresence] = useState<StockUnitComponentPresence>(state?.presence || 'PRESENT');
  const [quantity, setQuantity] = useState(state?.presentQuantity ?? definition.requiredQuantity);
  const update = useMutation({ mutationFn: () => inventoryOperationsApi.updateComponentState(stockUnitId, definition.id, { presence, presentQuantity: presence === 'MISSING' ? 0 : quantity }), onSuccess: async () => { await refresh(); toast.success('Component state updated'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not update component state')) });
  const dirty = presence !== (state?.presence || 'PRESENT') || quantity !== (state?.presentQuantity ?? definition.requiredQuantity);
  return <Card><CardContent className="grid items-center gap-4 p-4 md:grid-cols-[1fr_180px_120px_auto_auto]"><div><p className="font-medium">{definition.name} × {definition.requiredQuantity}</p><p className="text-xs text-muted-foreground">{definition.inspectionGuidance || 'No special inspection guidance'} · {definition.absenceBlocksRental ? 'Required' : 'Optional'}</p></div><Select value={presence} onValueChange={(value) => setPresence(value as StockUnitComponentPresence)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRESENCE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select><Input aria-label={`${definition.name} quantity`} type="number" min={0} value={quantity} onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))} /><Button size="sm" disabled={!dirty || update.isPending} onClick={() => update.mutate()}>Save</Button><Button size="icon" variant="ghost" aria-label={`Deactivate ${definition.name}`} onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button></CardContent></Card>;
}

function ComponentsPanel({ data, refresh }: { data: StockUnitOperations; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [guidance, setGuidance] = useState('');
  const [blocking, setBlocking] = useState(true);
  const create = useMutation({ mutationFn: () => inventoryOperationsApi.createSetComponent(data.stockUnit.variantSize.id, { name, requiredQuantity: quantity, inspectionGuidance: guidance.trim() || undefined, absenceBlocksRental: blocking }), onSuccess: async () => { setOpen(false); setName(''); await refresh(); toast.success('Set component added to this SKU'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not add set component')) });
  const remove = useMutation({ mutationFn: inventoryOperationsApi.deactivateSetComponent, onSuccess: async () => { await refresh(); toast.success('Set component deactivated'); }, onError: (error) => toast.error(apiErrorMessage(error, 'Could not remove set component')) });
  const states = new Map(data.stockUnit.componentStates.map((state) => [state.setComponentDefinitionId, state]));
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">Set completeness</h2><p className="text-sm text-muted-foreground">Define every piece in this SKU, then track completeness on this exact asset.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add component</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add SKU set component</DialogTitle><DialogDescription>Examples: blouse, dupatta, earring pair, brooch, belt, or garment bag.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-2"><Label>Required quantity</Label><Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></div><div className="grid gap-2"><Label>Inspection guidance</Label><Textarea value={guidance} onChange={(event) => setGuidance(event.target.value)} /></div><div className="flex items-center gap-2"><Checkbox id="absence-blocks" checked={blocking} onCheckedChange={(checked) => setBlocking(checked === true)} /><Label htmlFor="absence-blocks">Missing or damaged component blocks rental</Label></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>Add component</Button></DialogFooter></DialogContent></Dialog></div>{!data.stockUnit.variantSize.setComponentDefinitions.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">This SKU is currently a single-piece item. Add components only when the rentable unit is a set.</CardContent></Card> : data.stockUnit.variantSize.setComponentDefinitions.map((definition) => <ComponentStateRow key={definition.id} definition={definition} state={states.get(definition.id)} stockUnitId={data.stockUnit.id} refresh={refresh} remove={() => remove.mutate(definition.id)} />)}</div>;
}

function Overview({ data }: { data: StockUnitOperations }) {
  const unit = data.stockUnit;
  const blockingIssues = data.issues.filter((issue) => issue.isAvailabilityBlocking && ['OPEN', 'IN_SERVICE'].includes(issue.status));
  const activeService = data.serviceOrders.filter((order) => order.isAvailabilityBlocking && ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(order.status));
  const incompleteComponents = unit.componentStates.filter((state) => state.setComponentDefinition.absenceBlocksRental && (state.presence === 'MISSING' || state.presence === 'DAMAGED' || state.presentQuantity < state.setComponentDefinition.requiredQuantity));
  return <div className="space-y-4">{(blockingIssues.length > 0 || activeService.length > 0 || incompleteComponents.length > 0) && <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Not ready for availability</AlertTitle><AlertDescription>{blockingIssues.length} blocking issue(s), {activeService.length} active blocking service order(s), and {incompleteComponents.length} incomplete required component(s).</AlertDescription></Alert>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><CardHeader className="pb-2"><CardDescription>Condition</CardDescription><CardTitle className="text-lg">{label(unit.condition)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Active assignments</CardDescription><CardTitle className="text-lg">{unit.assignments.length}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Open issues</CardDescription><CardTitle className="text-lg">{data.issues.filter((issue) => ['OPEN', 'IN_SERVICE'].includes(issue.status)).length}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Completed inspections</CardDescription><CardTitle className="text-lg">{data.inspections.filter((inspection) => inspection.status === 'COMPLETED').length}</CardTitle></CardHeader></Card></div><Card><CardHeader><CardTitle className="text-base">Item details</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><p className="text-muted-foreground">Barcode</p><p>{unit.barcode || '—'}</p></div><div><p className="text-muted-foreground">Location</p><p>{unit.locationLabel || '—'}</p></div><div><p className="text-muted-foreground">Purchase date</p><p>{unit.purchaseDate?.slice(0, 10) || '—'}</p></div><div><p className="text-muted-foreground">Purchase cost</p><p>{unit.purchasePrice == null ? '—' : `৳${unit.purchasePrice.toLocaleString()}`}</p></div><div className="sm:col-span-2"><p className="text-muted-foreground">Notes</p><p>{unit.notes || '—'}</p></div></CardContent></Card>{unit.assignments.length > 0 && <Card><CardHeader><CardTitle className="text-base">Current and future assignments</CardTitle></CardHeader><CardContent className="space-y-2">{unit.assignments.map((assignment) => <div key={assignment.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm"><Link className="font-medium hover:underline" href={`/dashboard/bookings/${assignment.reservation.bookingId}`}>Booking {assignment.reservation.bookingId.slice(0, 8)}</Link><span className="text-muted-foreground">{assignment.blockedStartDate.slice(0, 10)} → {assignment.blockedEndDate.slice(0, 10)}</span></div>)}</CardContent></Card>}</div>;
}

export default function StockUnitOperationsPage() {
  const { id: productId, stockUnitId } = useParams<{ id: string; stockUnitId: string }>();
  const queryClient = useQueryClient();
  const unitQuery = useQuery({ queryKey: ['stock-unit-operations', stockUnitId], queryFn: () => inventoryOperationsApi.getUnit(stockUnitId), enabled: !!stockUnitId });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stock-unit-operations', stockUnitId] }),
      queryClient.invalidateQueries({ queryKey: ['stock-units'] }),
      queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] }),
    ]);
  };
  const blockingCount = useMemo(() => unitQuery.data?.issues.filter((issue) => issue.isAvailabilityBlocking && ['OPEN', 'IN_SERVICE'].includes(issue.status)).length ?? 0, [unitQuery.data]);

  if (unitQuery.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (unitQuery.isError || !unitQuery.data) return <div className="space-y-4"><Button variant="ghost" asChild><Link href={`/dashboard/products/${productId}/inventory`}><ArrowLeft className="mr-2 h-4 w-4" />Back to inventory</Link></Button><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Physical item could not be loaded</AlertTitle><AlertDescription>{apiErrorMessage(unitQuery.error, 'The item may no longer exist or you may not have access.')}</AlertDescription></Alert></div>;

  const data = unitQuery.data;
  const unit = data.stockUnit;
  return <div className="space-y-6 pb-12">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-1"><Button variant="ghost" size="sm" className="-ml-3" asChild><Link href={`/dashboard/products/${productId}/inventory`}><ArrowLeft className="mr-2 h-4 w-4" />Back to inventory</Link></Button><h1 className="font-mono text-2xl font-semibold tracking-tight">{unit.assetCode}</h1><p className="text-sm text-muted-foreground">{unit.variantSize.variant.product.name} · {unit.variantSize.variant.variantName || unit.variantSize.variant.mainColor.name} · Size {unit.variantSize.sizeInstance.displayLabel}</p></div><div className="flex flex-wrap gap-2"><Badge variant={availabilityVariant(unit)}>{label(unit.disposition)}</Badge><Badge variant="outline">{label(unit.operationalState)}</Badge><Badge variant="outline">{label(unit.condition)}</Badge>{blockingCount > 0 && <Badge variant="destructive">{blockingCount} blocking issue{blockingCount === 1 ? '' : 's'}</Badge>}</div></div>
    <LifecyclePanel data={data} refresh={refresh} />
    <Tabs defaultValue="overview" className="space-y-4"><TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="overview"><PackageCheck className="mr-2 h-4 w-4" />Overview</TabsTrigger><TabsTrigger value="inspections"><ClipboardCheck className="mr-2 h-4 w-4" />Inspections</TabsTrigger><TabsTrigger value="issues"><ShieldAlert className="mr-2 h-4 w-4" />Issues</TabsTrigger><TabsTrigger value="service"><Wrench className="mr-2 h-4 w-4" />Service</TabsTrigger><TabsTrigger value="components"><Stethoscope className="mr-2 h-4 w-4" />Set checklist</TabsTrigger><TabsTrigger value="history"><History className="mr-2 h-4 w-4" />History</TabsTrigger></TabsList>
      <TabsContent value="overview"><Overview data={data} /></TabsContent>
      <TabsContent value="inspections"><InspectionsPanel data={data} refresh={refresh} /></TabsContent>
      <TabsContent value="issues"><IssuesPanel data={data} refresh={refresh} /></TabsContent>
      <TabsContent value="service"><ServicePanel data={data} refresh={refresh} /></TabsContent>
      <TabsContent value="components"><ComponentsPanel data={data} refresh={refresh} /></TabsContent>
      <TabsContent value="history"><div className="space-y-3">{!data.lifecycleEvents.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No lifecycle changes recorded.</CardContent></Card> : data.lifecycleEvents.map((event) => <Card key={event.id}><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4"><div><p className="text-sm font-medium">{label(event.fromDisposition)} / {label(event.fromOperationalState)} → {label(event.toDisposition)} / {label(event.toOperationalState)}</p><p className="text-sm text-muted-foreground">{event.reason}</p></div><p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}{event.actor ? ` · ${event.actor.fullName}` : ''}</p></CardContent></Card>)}</div></TabsContent>
    </Tabs>
  </div>;
}
