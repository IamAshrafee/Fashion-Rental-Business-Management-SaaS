'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  inventoryApi,
  type InventoryCountDetail,
  type InventoryCountSummary,
} from '@/lib/api/inventory';
import { getApiErrorMessage } from '@/lib/api-error';
import { FieldTip } from '@/components/shared/field-tip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { OwnerListEmpty, OwnerListError, OwnerTableSkeleton } from '@/components/owner/workspace';

function findingLabels(item: InventoryCountDetail['items'][number]) {
  return [
    item.missing ? 'Missing' : null,
    item.unexpected ? 'Unexpected' : null,
    item.wrongLocation ? 'Wrong location' : null,
    item.requiresOperationalReview ? 'Operational review' : null,
  ].filter((label): label is string => Boolean(label));
}

function CountMetrics({ count }: { count: InventoryCountSummary }) {
  const metrics = [
    ['Expected', count.expectedCount],
    ['Observed identities', count.observedUniqueCount],
    ['Missing', count.missingCount],
    ['Unexpected', count.unexpectedCount],
    ['Wrong location', count.wrongLocationCount],
    ['Duplicate scans', count.duplicateScanCount],
    ['Unknown scans', count.unknownScanCount],
    ['Operational review', count.operationalReviewCount],
  ] as const;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CountDetail({ count }: { count: InventoryCountDetail }) {
  const discrepancies = count.items.filter(
    (item) =>
      item.missing || item.unexpected || item.wrongLocation || item.requiresOperationalReview,
  );
  const scanProblems = count.observations.filter(
    (observation) => observation.isDuplicate || observation.identityMatch === 'UNKNOWN',
  );
  const isClean = discrepancies.length === 0 && scanProblems.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {isClean ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="size-5 text-amber-600" />
              )}
              {count.location.name} count result
              <FieldTip helpKey="inventory.countFindings" />
            </CardTitle>
            <CardDescription>
              {new Date(count.completedAt).toLocaleString()} · {count.completedBy.fullName} ·{' '}
              {count.reason}
            </CardDescription>
          </div>
          <Badge variant={isClean ? 'default' : 'secondary'}>
            {isClean ? 'No discrepancies' : 'Follow-up required'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <CountMetrics count={count} />
        {count.notes ? <p className="rounded-md bg-muted p-3 text-sm">{count.notes}</p> : null}

        {discrepancies.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Item findings</h3>
            {discrepancies.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-mono text-sm font-medium">{item.stockUnit.assetCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.stockUnit.variantSize.variant.product.name} ·{' '}
                    {item.stockUnit.variantSize.variant.variantName || 'Default'} ·{' '}
                    {item.stockUnit.variantSize.sizeInstance.displayLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recorded at {item.recordedLocation.name} · {item.recordedDisposition} ·{' '}
                    {item.recordedOperationalState}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {findingLabels(item).map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/products/${item.stockUnit.variantSize.variant.product.id}/inventory/${item.stockUnit.id}`}
                    >
                      Review item
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {scanProblems.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Scan findings</h3>
            {scanProblems.map((observation) => (
              <div
                key={observation.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <span className="font-mono">{observation.scannedIdentity}</span>
                <div className="flex gap-2">
                  {observation.identityMatch === 'UNKNOWN' ? (
                    <Badge variant="outline">Unknown identity</Badge>
                  ) : null}
                  {observation.isDuplicate ? <Badge variant="outline">Duplicate scan</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {isClean ? (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertTitle>Count reconciled cleanly</AlertTitle>
            <AlertDescription>
              Every expected physical item was observed once, with no unknown or wrong-location
              identities.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>No item records were silently changed</AlertTitle>
            <AlertDescription>
              Use each item&apos;s transfer, inspection, loss/recovery, or lifecycle action to
              resolve the findings. This count and its item-specific investigation movements remain
              immutable.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryCountsWorkspace() {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState('');
  const [identityText, setIdentityText] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });
  const counts = useQuery({
    queryKey: ['inventory-counts'],
    queryFn: () => inventoryApi.listCounts({ page: 1, limit: 25 }),
  });
  const selectedCount = useQuery({
    queryKey: ['inventory-count', selectedCountId],
    queryFn: () => inventoryApi.getCount(selectedCountId!),
    enabled: Boolean(selectedCountId),
  });
  const identities = useMemo(
    () =>
      identityText
        .split(/[\n,]+/)
        .map((identity) => identity.trim())
        .filter(Boolean),
    [identityText],
  );
  const reconcile = useMutation({
    mutationFn: () =>
      inventoryApi.reconcileCount({
        locationId,
        identities,
        reason: reason.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        idempotencyKey,
      }),
    onSuccess: async ({ replayed, session }) => {
      queryClient.setQueryData(['inventory-count', session.id], session);
      setSelectedCountId(session.id);
      setIdentityText('');
      setReason('');
      setNotes('');
      setIdempotencyKey(crypto.randomUUID());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] }),
      ]);
      toast.success(replayed ? 'Existing stock count reopened' : 'Stock count reconciled');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'The stock count could not be reconciled.')),
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stock counts</h1>
        <p className="text-sm text-muted-foreground">
          Reconcile the exact physical pieces observed at one inventory location.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="size-5" />
            Start an identity count
            <FieldTip helpKey="inventory.stockCount" />
          </CardTitle>
          <CardDescription>
            Scan into the field or enter one asset code or barcode per line. Completing the count
            records evidence and findings; it does not change item location or lifecycle state.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="count-location">Count location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="count-location">
                <SelectValue placeholder="Select an active storage location" />
              </SelectTrigger>
              <SelectContent>
                {locations.data
                  ?.filter((location) => location.isActive && location.canStoreInventory)
                  .map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="count-reason">Count reason</Label>
            <Input
              id="count-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Monthly showroom count"
            />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="count-identities">Observed asset codes or barcodes</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {identities.length} scans
              </span>
            </div>
            <Textarea
              id="count-identities"
              className="min-h-40 font-mono"
              value={identityText}
              onChange={(event) => setIdentityText(event.target.value)}
              placeholder={'DRS-001\nDRS-002\n8901234567890'}
            />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="count-notes">Notes (optional)</Label>
            <Textarea
              id="count-notes"
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Shift, shelf, scanner, or investigation context"
            />
          </div>
          <div className="lg:col-span-2">
            <Button
              type="button"
              disabled={!locationId || !identities.length || !reason.trim() || reconcile.isPending}
              onClick={() => reconcile.mutate()}
            >
              {reconcile.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Reconcile {identities.length || 0} scans
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedCount.isLoading ? <OwnerTableSkeleton columns={4} /> : null}
      {selectedCount.isError ? (
        <OwnerListError
          message="The selected count result could not be loaded."
          onRetry={() => void selectedCount.refetch()}
        />
      ) : null}
      {selectedCount.data ? <CountDetail count={selectedCount.data} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent completed counts</CardTitle>
          <CardDescription>
            Immutable count summaries. Open one to review its exact scans and item findings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {counts.isLoading ? (
            <OwnerTableSkeleton columns={4} />
          ) : counts.isError ? (
            <OwnerListError
              message="Stock-count history could not be loaded."
              onRetry={() => void counts.refetch()}
            />
          ) : !counts.data?.data.length ? (
            <OwnerListEmpty
              title="No stock counts yet"
              description="Complete the first identity count to establish an auditable reconciliation record."
              icon={<ClipboardCheck />}
            />
          ) : (
            counts.data.data.map((count) => {
              const discrepancyCount =
                count.missingCount +
                count.unexpectedCount +
                count.duplicateScanCount +
                count.unknownScanCount +
                count.wrongLocationCount +
                count.operationalReviewCount;
              return (
                <button
                  key={count.id}
                  type="button"
                  className="rounded-md border p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelectedCountId(count.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{count.location.name}</p>
                      <p className="text-sm text-muted-foreground">{count.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(count.completedAt).toLocaleString()} ·{' '}
                        {count.completedBy.fullName}
                      </p>
                    </div>
                    <Badge variant={discrepancyCount ? 'secondary' : 'default'}>
                      {discrepancyCount ? `${discrepancyCount} finding signals` : 'Clean count'}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <span>Expected: {count.expectedCount}</span>
                    <span>Observed: {count.observedUniqueCount}</span>
                    <span>Missing: {count.missingCount}</span>
                    <span>Unexpected: {count.unexpectedCount}</span>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
