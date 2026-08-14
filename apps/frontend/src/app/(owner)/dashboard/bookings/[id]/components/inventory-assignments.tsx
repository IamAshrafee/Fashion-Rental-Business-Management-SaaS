'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  Loader2,
  PackageCheck,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { fulfillmentApi, type FulfillmentRequirement } from '@/lib/api/fulfillment';
import { productApi, type ProductListItem } from '@/lib/api/products';
import { formatMinorMoney, majorInputToMinor } from '@/lib/money';
import { getApiErrorMessage } from '@/lib/api-error';
import { FieldTip } from '@/components/shared/field-tip';

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function assignmentIdsFrom(requirement: FulfillmentRequirement, eventType: string) {
  return new Set(
    requirement.events
      .filter((event) => event.eventType === eventType)
      .flatMap((event) => event.metadata?.assignmentIds || []),
  );
}

function AssignmentPanel({
  bookingId,
  requirement,
  refresh,
}: {
  bookingId: string;
  requirement: FulfillmentRequirement;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const options = useQuery({
    queryKey: ['fulfillment-assignment-options', bookingId, requirement.id],
    queryFn: () =>
      fulfillmentApi.getAssignmentOptions(bookingId, requirement.bookingItemId, requirement.id),
    enabled: !!requirement.reservation,
  });
  const remaining = Math.max(0, requirement.quantity - requirement.assignedQuantity);
  const returnedAssets = (requirement.reservation?.assignments || []).filter(
    (assignment) =>
      assignment.releasedAt && assignment.stockUnit.operationalState === 'AWAITING_INSPECTION',
  );
  const assign = useMutation({
    mutationFn: () =>
      fulfillmentApi.assignUnits(bookingId, requirement.bookingItemId, requirement.id, selected),
    onSuccess: async () => {
      setSelected([]);
      await refresh();
      toast.success('Physical units assigned');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not assign units')),
  });
  const release = useMutation({
    mutationFn: (assignmentId: string) =>
      fulfillmentApi.releaseUnit(
        bookingId,
        requirement.bookingItemId,
        requirement.id,
        assignmentId,
        'Released from fulfillment workspace',
      ),
    onSuccess: async () => {
      await refresh();
      toast.success('Assignment released');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not release assignment')),
  });

  if (options.isLoading)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading physical units…
      </p>
    );
  return (
    <div className="space-y-3">
      {!!options.data?.assigned.length && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Assigned assets
          </p>
          {options.data.assigned.map((assignment) => (
            <div
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div>
                <p className="font-mono text-sm font-medium">{assignment.stockUnit.assetCode}</p>
                <p className="text-xs text-muted-foreground">
                  {humanize(assignment.stockUnit.operationalState)} ·{' '}
                  {humanize(assignment.stockUnit.condition)} · {assignment.stockUnit.location.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={`/dashboard/products/${requirement.productId}/inventory/${assignment.stockUnit.id}`}
                  >
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Prepare / inspect
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={release.isPending || requirement.handedOutQuantity > 0 || requirement.preparationStatus === 'READY'}
                  onClick={() => release.mutate(assignment.id)}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                  Release
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!!returnedAssets.length && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Returned assets awaiting inspection
          </p>
          {returnedAssets.map((assignment) => (
            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-orange-200 bg-orange-50/40 p-3">
              <div>
                <p className="font-mono text-sm font-medium">{assignment.stockUnit.assetCode}</p>
                <p className="text-xs text-muted-foreground">Return inspection required before booking settlement</p>
              </div>
              <Button size="sm" asChild>
                <Link href={`/dashboard/products/${requirement.productId}/inventory/${assignment.stockUnit.id}`}>
                  <ClipboardCheck className="mr-1 size-3.5" />Inspect item
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
      {remaining > 0 && requirement.preparationStatus !== 'READY' && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Eligible assets <FieldTip helpKey="fulfillment.assignment" />
          </p>
          {!options.data?.eligible.length ? (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              No active, unblocked physical unit is eligible at{' '}
              {requirement.sourceLocation?.name || 'the reserved source location'} for the full
              rental period.
            </p>
          ) : (
            options.data.eligible.map((unit) => (
              <label
                key={unit.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/30"
              >
                <Checkbox
                  checked={selected.includes(unit.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked
                        ? [...current, unit.id].slice(0, remaining)
                        : current.filter((id) => id !== unit.id),
                    )
                  }
                />
                <span>
                  <span className="block font-mono text-sm font-medium">{unit.assetCode}</span>
                  <span className="block text-xs text-muted-foreground">
                    {humanize(unit.operationalState)} · {humanize(unit.condition)} ·{' '}
                    {unit.location.name}
                  </span>
                </span>
              </label>
            ))
          )}
          <Button
            size="sm"
            disabled={!selected.length || assign.isPending}
            onClick={() => assign.mutate()}
          >
            {assign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign selected (
            {selected.length})
          </Button>
        </div>
      )}
    </div>
  );
}

function EventDialog({
  requirement,
  eventType,
  refresh,
}: {
  requirement: FulfillmentRequirement;
  eventType: 'HANDED_OUT' | 'RETURNED' | 'MARKED_LOST';
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const handed = assignmentIdsFrom(requirement, 'HANDED_OUT');
  const resolved = new Set([
    ...assignmentIdsFrom(requirement, 'RETURNED'),
    ...assignmentIdsFrom(requirement, 'MARKED_LOST'),
  ]);
  const assignments = requirement.reservation?.assignments || [];
  const eligibleAssignments =
    eventType === 'HANDED_OUT'
      ? assignments.filter((assignment) => !handed.has(assignment.id))
      : assignments.filter(
          (assignment) => handed.has(assignment.id) && !resolved.has(assignment.id),
        );
  const max =
    eventType === 'HANDED_OUT'
      ? requirement.quantity - requirement.handedOutQuantity
      : requirement.handedOutQuantity - requirement.returnedQuantity - requirement.lostQuantity;
  const record = useMutation({
    mutationFn: () =>
      fulfillmentApi.recordEvent(requirement.id, {
        eventType,
        quantity: selected.length,
        reason,
        assignmentIds: selected,
        idempotencyKey: `${requirement.id}:${eventType}:${crypto.randomUUID()}`,
      }),
    onSuccess: async () => {
      setOpen(false);
      setSelected([]);
      setReason('');
      await refresh();
      toast.success(`${humanize(eventType)} recorded`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not record fulfillment event')),
  });
  const validQuantity = selected.length > 0 && selected.length <= max;
  const config =
    eventType === 'HANDED_OUT'
      ? { label: 'Hand out', icon: PackageCheck, variant: 'default' as const }
      : eventType === 'RETURNED'
        ? { label: 'Receive return', icon: RotateCcw, variant: 'outline' as const }
        : { label: 'Mark lost', icon: AlertTriangle, variant: 'destructive' as const };
  const Icon = config.icon;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={config.variant} disabled={max <= 0}>
          <Icon className="mr-1 h-3.5 w-3.5" />
          {config.label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {config.label} · {requirement.productNameSnapshot}
          </DialogTitle>
          <DialogDescription>
            This posts an auditable movement for each selected physical item. Returned items move
            to awaiting inspection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
              <Label>
                Select exact physical items{' '}
                <FieldTip
                  helpKey={
                    eventType === 'HANDED_OUT'
                      ? 'fulfillment.handout'
                      : eventType === 'RETURNED'
                        ? 'fulfillment.return'
                        : 'fulfillment.loss'
                  }
                />
              </Label>
            {eligibleAssignments.map((assignment) => (
              <label
                key={assignment.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
              >
                <Checkbox
                  checked={selected.includes(assignment.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked
                        ? [...current, assignment.id].slice(0, max)
                        : current.filter((id) => id !== assignment.id),
                    )
                  }
                />
                <span className="font-mono text-sm">{assignment.stockUnit.assetCode}</span>
              </label>
            ))}
          </div>
          <div className="grid gap-2">
            <Label>Operational reason / note</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Who received it, return observation, or loss details"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={config.variant}
            disabled={!reason.trim() || !validQuantity || record.isPending}
            onClick={() => record.mutate()}
          >
            {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreparationDialog({
  requirement,
  targetStatus,
  refresh,
}: {
  requirement: FulfillmentRequirement;
  targetStatus: 'IN_PROGRESS' | 'READY';
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const prepare = useMutation({
    mutationFn: () => fulfillmentApi.prepareRequirement(requirement.id, {
      preparationStatus: targetStatus,
      reason,
      idempotencyKey: `${requirement.id}:preparation:${targetStatus}:${crypto.randomUUID()}`,
    }),
    onSuccess: async () => {
      setOpen(false);
      setReason('');
      await refresh();
      toast.success(targetStatus === 'READY' ? 'Item preparation completed' : 'Preparation started');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update preparation')),
  });
  const ready = targetStatus === 'READY';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={ready ? 'default' : 'outline'}>
          <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
          {ready ? 'Mark ready' : requirement.preparationStatus === 'READY' ? 'Reopen preparation' : 'Start preparation'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {ready ? 'Confirm preparation is complete' : requirement.preparationStatus === 'READY' ? 'Reopen item preparation' : 'Start item preparation'}
          </DialogTitle>
          <DialogDescription>
            {ready
              ? 'Confirm the complete requirement is checked, assembled, cleaned, and ready for handout.'
              : 'Record that the team has started preparing this requirement.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>Preparation note <FieldTip helpKey="fulfillment.preparation" /></Label>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={ready ? 'Checks completed, accessories included, packed by…' : 'Assigned to, preparation instructions…'}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!reason.trim() || prepare.isPending} onClick={() => prepare.mutate()}>
            {prepare.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ready ? 'Confirm ready' : requirement.preparationStatus === 'READY' ? 'Reopen preparation' : 'Start preparation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubstituteDialog({
  requirement,
  products,
  refresh,
}: {
  requirement: FulfillmentRequirement;
  products: ProductListItem[];
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(requirement.productId || '');
  const [variantSizeId, setVariantSizeId] = useState('');
  const [reason, setReason] = useState('');
  const [priceImpact, setPriceImpact] = useState('0');
  const [approvalEvidence, setApprovalEvidence] = useState('');
  const [equivalentConfirmed, setEquivalentConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const productQuery = useQuery({
    queryKey: ['fulfillment-substitute-product', productId],
    queryFn: () => productApi.getById(productId),
    enabled: open && !!productId,
  });
  const skus = useMemo(
    () =>
      productQuery.data?.variants.flatMap((variant) =>
        variant.sizes.map((size) => ({
          id: size.id,
          label: `${variant.variantName || variant.mainColor.name} · ${size.sizeInstance.displayLabel}`,
        })),
      ) || [],
    [productQuery.data],
  );
  const allowedProductIds = new Set(
    [
      requirement.compositionRule?.componentProductId,
      ...(requirement.compositionRule?.alternatives.map((item) => item.productId) || []),
    ].filter(Boolean),
  );
  const choices =
    requirement.role === 'MAIN'
      ? products
      : products.filter((product) => allowedProductIds.has(product.id));
  const substitute = useMutation({
    mutationFn: () =>
      fulfillmentApi.substitute(requirement.id, {
        productId,
        variantSizeId,
        reason,
        idempotencyKey,
        compatibilityResult:
          requirement.compositionRule?.substitutionPolicy === 'EQUIVALENT_ONLY'
            ? { compatible: equivalentConfirmed }
            : undefined,
        approvalStatus:
          requirement.compositionRule?.substitutionPolicy === 'CUSTOMER_APPROVAL'
          || requirement.compositionRule?.substitutionPolicy === 'STAFF_APPROVAL'
          || requirement.compositionRule?.customerApprovalRequired
            ? 'APPROVED'
            : 'NOT_REQUIRED',
        approvalEvidence: approvalEvidence.trim() || undefined,
        priceImpact: majorInputToMinor(priceImpact) ?? 0,
      }),
    onSuccess: async () => {
      setOpen(false);
      await refresh();
      toast.success('Component substituted and availability re-reserved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not substitute component')),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setIdempotencyKey(crypto.randomUUID());
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Search className="mr-1 h-3.5 w-3.5" />
          Resolve / substitute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve or substitute component</DialogTitle>
          <DialogDescription>
            The previous selection remains in version history. Existing physical assignments must be
            released first.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Allowed product</Label>
            <Select
              value={productId}
              onValueChange={(value) => {
                setProductId(value);
                setVariantSizeId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>SKU / size</Label>
            <Select
              value={variantSizeId}
              onValueChange={setVariantSizeId}
              disabled={productQuery.isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select SKU" />
              </SelectTrigger>
              <SelectContent>
                {skus.map((sku) => (
                  <SelectItem key={sku.id} value={sku.id}>
                    {sku.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Reason and compatibility decision</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Rental price impact (৳)</Label>
            <Input
              type="number"
              step="0.01"
              value={priceImpact}
              onChange={(event) => setPriceImpact(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Use a negative amount for an approved reduction. Booking totals update atomically.</p>
          </div>
          {requirement.compositionRule?.substitutionPolicy === 'EQUIVALENT_ONLY' && (
            <label className="flex items-start gap-2 rounded-md border p-3 text-xs">
              <Checkbox checked={equivalentConfirmed} onCheckedChange={(checked) => setEquivalentConfirmed(checked === true)} />
              <span>I checked the configured size, style, component, and condition compatibility rules.</span>
            </label>
          )}
          {(requirement.compositionRule?.substitutionPolicy === 'CUSTOMER_APPROVAL'
            || requirement.compositionRule?.customerApprovalRequired) && (
            <div className="grid gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              <Label>Customer approval evidence</Label>
              <Textarea
                value={approvalEvidence}
                onChange={(event) => setApprovalEvidence(event.target.value)}
                placeholder="Approved by phone at 3:20 PM; WhatsApp message reference…"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !productId
              || !variantSizeId
              || !reason.trim()
              || (requirement.compositionRule?.substitutionPolicy === 'EQUIVALENT_ONLY' && !equivalentConfirmed)
              || ((requirement.compositionRule?.substitutionPolicy === 'CUSTOMER_APPROVAL'
                || requirement.compositionRule?.customerApprovalRequired) && !approvalEvidence.trim())
              || substitute.isPending
            }
            onClick={() => substitute.mutate()}
          >
            {substitute.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply
            selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementCard({
  bookingId,
  bookingStatus,
  requirement,
  products,
  refresh,
}: {
  bookingId: string;
  bookingStatus: string;
  requirement: FulfillmentRequirement;
  products: ProductListItem[];
  refresh: () => Promise<void>;
}) {
  const unresolved =
    requirement.handedOutQuantity - requirement.returnedQuantity - requirement.lostQuantity;
  const canSubstitute =
    ['pending', 'confirmed'].includes(bookingStatus) &&
    requirement.handedOutQuantity === 0 &&
    !['RETURNED', 'LOST', 'CANCELLED', 'SUPERSEDED'].includes(requirement.status);
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{requirement.productNameSnapshot}</CardTitle>
              <Badge variant="outline">{humanize(requirement.role)}</Badge>
            </div>
            <CardDescription>
              {requirement.variantNameSnapshot || 'Variant pending'} ·{' '}
              {requirement.sizeSnapshot || 'SKU selection required'} · quantity{' '}
              {requirement.quantity}
            </CardDescription>
          </div>
          <Badge>{humanize(requirement.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Fulfillment source:{' '}
          <span className="font-medium text-foreground">
            {requirement.sourceLocation?.name || 'Not planned'}
          </span>
        </p>
        <div className="grid grid-cols-4 gap-2 rounded-md bg-muted/30 p-3 text-center text-xs">
          <div>
            <strong className="block text-base">{requirement.assignedQuantity}</strong>Assigned
          </div>
          <div>
            <strong className="block text-base">{requirement.handedOutQuantity}</strong>Out
          </div>
          <div>
            <strong className="block text-base">{requirement.returnedQuantity}</strong>Returned
          </div>
          <div>
            <strong className="block text-base">{requirement.lostQuantity}</strong>Lost
          </div>
        </div>
        <AssignmentPanel bookingId={bookingId} requirement={requirement} refresh={refresh} />
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
          <div>
            <p className="text-xs font-medium">Preparation: {humanize(requirement.preparationStatus)}</p>
            {requirement.preparedAt && (
              <p className="text-xs text-muted-foreground">
                Ready since {new Date(requirement.preparedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {bookingStatus === 'confirmed' && requirement.preparationStatus === 'NOT_STARTED' && requirement.handedOutQuantity === 0 && (
              <PreparationDialog requirement={requirement} targetStatus="IN_PROGRESS" refresh={refresh} />
            )}
            {bookingStatus === 'confirmed' && requirement.preparationStatus === 'READY' && requirement.handedOutQuantity === 0 && (
              <PreparationDialog requirement={requirement} targetStatus="IN_PROGRESS" refresh={refresh} />
            )}
            {bookingStatus === 'confirmed' && requirement.preparationStatus !== 'READY' && requirement.handedOutQuantity === 0 && (
              <PreparationDialog requirement={requirement} targetStatus="READY" refresh={refresh} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubstitute && (
            <SubstituteDialog requirement={requirement} products={products} refresh={refresh} />
          )}
          {bookingStatus === 'confirmed' && requirement.preparationStatus === 'READY' && (
            <EventDialog requirement={requirement} eventType="HANDED_OUT" refresh={refresh} />
          )}
          {['delivered', 'overdue'].includes(bookingStatus) && unresolved > 0 && (
            <>
              <EventDialog requirement={requirement} eventType="RETURNED" refresh={refresh} />
              <EventDialog requirement={requirement} eventType="MARKED_LOST" refresh={refresh} />
            </>
          )}
        </div>
        {!!requirement.events.length && (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Activity history ({requirement.events.length})
            </summary>
            <div className="mt-2 space-y-2">
              {requirement.events.map((event) => (
                <div key={event.id} className="border-l-2 pl-3 text-xs">
                  <p className="font-medium">
                    {humanize(event.eventType)} · {event.quantity}
                  </p>
                  <p className="text-muted-foreground">
                    {event.reason} · {event.actor?.fullName || 'System'} · {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
        {!!requirement.substitutions.length && (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Substitution history ({requirement.substitutions.length})
            </summary>
            <div className="mt-2 space-y-2">
              {requirement.substitutions.map((substitution) => (
                <div key={substitution.id} className="border-l-2 pl-3 text-xs">
                  <p className="font-medium">
                    {humanize(substitution.approvalStatus)} · price impact {formatMinorMoney(substitution.priceImpact)}
                  </p>
                  <p className="text-muted-foreground">{substitution.reason}</p>
                  {substitution.approvalEvidence && <p className="text-muted-foreground">Approval: {substitution.approvalEvidence}</p>}
                  <p className="text-muted-foreground">{new Date(substitution.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryAssignments({ bookingId, bookingStatus }: { bookingId: string; bookingStatus: string }) {
  const queryClient = useQueryClient();
  const [extendOpen, setExtendOpen] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extensionCharge, setExtensionCharge] = useState('0');
  const [extensionEvidence, setExtensionEvidence] = useState('');
  const [extensionKey, setExtensionKey] = useState(() => crypto.randomUUID());
  const query = useQuery({
    queryKey: ['booking-fulfillment', bookingId],
    queryFn: () => fulfillmentApi.listBookingRequirements(bookingId),
    refetchInterval: 30_000,
  });
  const productsQuery = useQuery({
    queryKey: ['products-for-fulfillment'],
    queryFn: () => productApi.list({ limit: 100, sort: 'name', order: 'asc' }),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['booking-fulfillment', bookingId] }),
      queryClient.invalidateQueries({ queryKey: ['bookings', 'detail', bookingId] }),
    ]);
  };
  const extend = useMutation({
    mutationFn: () => fulfillmentApi.extendBookingDates(bookingId, {
      rentalEndDate: endDate,
      reason: extendReason.trim(),
      extensionCharge: majorInputToMinor(extensionCharge) ?? 0,
      approvalEvidence: extensionEvidence.trim(),
      idempotencyKey: extensionKey,
    }),
    onSuccess: async () => {
      setExtendOpen(false);
      setEndDate('');
      setExtendReason('');
      setExtensionCharge('0');
      setExtensionEvidence('');
      setExtensionKey(crypto.randomUUID());
      await refresh();
      toast.success('All fulfillment dates updated atomically');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update rental dates')),
  });
  const grouped = useMemo(
    () =>
      Object.entries(
        (query.data || []).reduce<Record<string, FulfillmentRequirement[]>>(
          (result, requirement) => {
            (result[requirement.bookingItemId] ||= []).push(requirement);
            return result;
          },
          {},
        ),
      ),
    [query.data],
  );
  if (query.isLoading)
    return (
      <section className="rounded-lg border p-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading bundle fulfillment…
        </p>
      </section>
    );
  if (!query.data?.length) return null;
  return (
    <section id="fulfillment-workspace" className="scroll-mt-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Boxes className="h-5 w-5" />
            Bundle fulfillment
          </h2>
          <p className="text-sm text-muted-foreground">
            Reserve, prepare, assign, hand out, return, and inspect every component independently.
          </p>
        </div>
        {['pending', 'confirmed', 'delivered', 'overdue'].includes(bookingStatus) && <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarClock className="mr-2 h-4 w-4" />
              Extend rental
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Extend the full rental</DialogTitle>
              <DialogDescription>
                Availability, component reservations, booking dates, item totals, and payment balance
                update together. If any component conflicts, nothing changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>New rental end date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Reason</Label>
                <Textarea
                  value={extendReason}
                  onChange={(event) => setExtendReason(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Extension charge (৳)</Label>
                <Input type="number" min="0" step="0.01" value={extensionCharge} onChange={(event) => setExtensionCharge(event.target.value)} />
                <p className="text-xs text-muted-foreground">Enter 0 only for an explicitly approved complimentary extension.</p>
              </div>
              <div className="grid gap-2">
                <Label>Customer or manager approval evidence</Label>
                <Textarea value={extensionEvidence} onChange={(event) => setExtensionEvidence(event.target.value)} placeholder="Message reference, call note, or manager approval" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExtendOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!endDate || !extendReason.trim() || !extensionEvidence.trim() || majorInputToMinor(extensionCharge) === undefined || extend.isPending}
                onClick={() => extend.mutate()}
              >
                {extend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Extend atomically
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>
      {grouped.map(([bookingItemId, requirements], index) => (
        <div key={bookingItemId} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Booking item {index + 1} · {requirements.length} fulfillment component
            {requirements.length === 1 ? '' : 's'}
          </h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {requirements.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                bookingId={bookingId}
                bookingStatus={bookingStatus}
                requirement={requirement}
                products={productsQuery.data?.data || []}
                refresh={refresh}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
