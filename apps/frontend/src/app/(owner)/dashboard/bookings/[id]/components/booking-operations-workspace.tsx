'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { bookingApi, type BookingOperationsV2, type BookingStageBlocker } from '@/lib/api/bookings';
import { getApiProblem } from '@/lib/api-error';
import { formatMinorMoney } from '@/lib/money';

interface BookingOperationsWorkspaceProps {
  bookingId: string;
  handoverMethod: 'DELIVERY' | 'CUSTOMER_PICKUP' | null;
  operations: BookingOperationsV2;
}

type OutboundMethod =
  | 'COURIER'
  | 'CUSTOMER_PICKUP'
  | 'INSTANT_DELIVERY'
  | 'STAFF_DELIVERY'
  | 'OTHER';

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function commandBlockers(error: unknown): BookingStageBlocker[] {
  const raw = getApiProblem(error).details.blockers;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.message !== 'string' || typeof item.code !== 'string') return [];
    return [
      {
        code: item.code,
        message: item.message,
        count: typeof item.count === 'number' ? item.count : undefined,
      },
    ];
  });
}

function BlockerList({ blockers }: { blockers: BookingStageBlocker[] }) {
  if (!blockers.length) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>Work is blocked</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {blockers.map((blocker) => (
            <li key={`${blocker.code}:${blocker.message}`}>
              {blocker.message}
              {blocker.amountMinor !== undefined
                ? ` · ${formatMinorMoney(blocker.amountMinor)}`
                : ''}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function BookingOperationsWorkspace({
  bookingId,
  handoverMethod,
  operations,
}: BookingOperationsWorkspaceProps) {
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [renewReason, setRenewReason] = useState('Inventory availability rechecked by staff');
  const [renewUntil, setRenewUntil] = useState('');
  const [outboundMethod, setOutboundMethod] = useState<OutboundMethod>(
    handoverMethod === 'CUSTOMER_PICKUP' ? 'CUSTOMER_PICKUP' : 'COURIER',
  );
  const [commandError, setCommandError] = useState<unknown>(null);
  const approveKey = useRef<string | null>(null);
  const rejectKey = useRef<string | null>(null);
  const renewKey = useRef<string | null>(null);
  const packingKeys = useRef(new Map<string, string>());
  const version = operations.currentVersion?.version;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };
  const resetApprovalAttempt = () => {
    approveKey.current = null;
    setCommandError(null);
  };
  const resetRejectionAttempt = () => {
    rejectKey.current = null;
    setCommandError(null);
  };
  const resetRenewalAttempt = () => {
    renewKey.current = null;
    setCommandError(null);
  };

  const approve = useMutation({
    mutationFn: () => {
      if (!version) throw new Error('This booking has no review version');
      approveKey.current ??= crypto.randomUUID();
      return bookingApi.approveAndReserve(
        bookingId,
        {
          expectedVersion: version,
          reason: approvalReason.trim() || undefined,
          outboundMethod,
          rentalStartPolicy: 'VERIFIED_HANDOVER',
          returnTimelinessPolicy: 'CUSTOMER_HANDOVER',
          depositCollectionTiming: 'HANDOVER',
        },
        approveKey.current,
      );
    },
    onSuccess: async () => {
      toast.success('Booking approved and exact inventory reserved');
      setApproveOpen(false);
      setCommandError(null);
      approveKey.current = null;
      await invalidate();
    },
    onError: (error) => {
      setCommandError(error);
      toast.error(getApiProblem(error, 'Could not approve this booking').message);
    },
  });

  const reject = useMutation({
    mutationFn: () => {
      if (!version) throw new Error('This booking has no review version');
      rejectKey.current ??= crypto.randomUUID();
      return bookingApi.rejectRequest(
        bookingId,
        { expectedVersion: version, reason: rejectionReason.trim() },
        rejectKey.current,
      );
    },
    onSuccess: async () => {
      toast.success('Booking request rejected and inventory released');
      setRejectOpen(false);
      setCommandError(null);
      rejectKey.current = null;
      await invalidate();
    },
    onError: (error) => {
      setCommandError(error);
      toast.error(getApiProblem(error, 'Could not reject this booking').message);
    },
  });

  const renew = useMutation({
    mutationFn: () => {
      if (!version) throw new Error('This booking has no review version');
      renewKey.current ??= crypto.randomUUID();
      return bookingApi.renewHold(
        bookingId,
        {
          expectedVersion: version,
          expiresAt: new Date(renewUntil).toISOString(),
          reason: renewReason.trim(),
        },
        renewKey.current,
      );
    },
    onSuccess: async () => {
      toast.success('Inventory hold renewed');
      setRenewOpen(false);
      setCommandError(null);
      renewKey.current = null;
      await invalidate();
    },
    onError: (error) => {
      setCommandError(error);
      toast.error(getApiProblem(error, 'Could not renew the inventory hold').message);
    },
  });

  const packing = useMutation({
    mutationFn: (group: BookingOperationsV2['fulfillmentGroups'][number]) => {
      const key = packingKeys.current.get(group.id) ?? crypto.randomUUID();
      packingKeys.current.set(group.id, key);
      return bookingApi.completePacking(
        bookingId,
        group.id,
        { expectedGroupVersion: group.version, reason: 'Exact items verified and packed together' },
        key,
      );
    },
    onSuccess: async (_, group) => {
      packingKeys.current.delete(group.id);
      toast.success(`Packing completed for ${group.originLocation.name}`);
      await invalidate();
    },
    onError: (error) => toast.error(getApiProblem(error, 'Could not complete packing').message),
  });

  const progress = operations.itemProgress;
  const progressValue =
    progress.total > 0
      ? Math.round(
          (Math.max(progress.assigned, progress.readyChecked, progress.packed) / progress.total) *
            100,
        )
      : 0;
  const dialogBlockers = commandBlockers(commandError);
  const problem = commandError ? getApiProblem(commandError) : null;
  const reviewOpen = operations.stage === 'REVIEW_RESERVE';

  return (
    <Card id="operations" className="scroll-mt-6 border-primary/20 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{operations.title}</CardTitle>
              <Badge variant={operations.modifier === 'ON_HOLD' ? 'destructive' : 'secondary'}>
                {humanize(operations.stage)}
                {operations.modifier ? ` · ${humanize(operations.modifier)}` : ''}
              </Badge>
              {operations.currentVersion && (
                <Badge variant="outline">Version {operations.currentVersion.version}</Badge>
              )}
            </div>
            <CardDescription>{operations.description}</CardDescription>
          </div>
          {operations.currentVersion?.decision === 'APPROVED' && (
            <Badge>
              <ShieldCheck className="mr-1 size-3" />
              Reserved
            </Badge>
          )}
        </div>
        <div className="space-y-2" aria-label="Physical item progress">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {progress.assigned}/{progress.total} assigned
            </span>
            <span>
              {progress.readyChecked}/{progress.total} Ready Checked
            </span>
            <span>
              {progress.packed}/{progress.total} packed
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <BlockerList blockers={operations.blockers} />

        {reviewOpen && (
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Exact inventory</p>
              <p className="font-medium">
                {progress.assigned} of {progress.total} assigned
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inventory hold</p>
              <p className="font-medium">
                {operations.review.holdExpiresAt
                  ? `${operations.review.holdExpired ? 'Expired' : 'Expires'} ${new Date(operations.review.holdExpiresAt).toLocaleString()}`
                  : 'No active hold'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fulfillment origins</p>
              <p className="font-medium">
                {operations.review.originLocations.map((location) => location.name).join(', ') ||
                  'Not resolved'}
              </p>
            </div>
          </div>
        )}

        {!!operations.fulfillmentGroups.length && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Exact fulfillment groups</h3>
              <p className="text-xs text-muted-foreground">
                Ready Check and packing remain separate evidence-backed steps.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {operations.fulfillmentGroups.map((group) => {
                const allocations = group.fulfillments.flatMap(
                  (fulfillment) => fulfillment.allocations,
                );
                const ready = allocations.filter(
                  (allocation) => allocation.status === 'READY',
                ).length;
                return (
                  <div key={group.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{group.originLocation.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {humanize(group.method)} · {ready}/{allocations.length} Ready Checked
                        </p>
                      </div>
                      <Badge variant="outline">{humanize(group.status)}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {allocations.map((allocation) => (
                        <Badge
                          key={allocation.id}
                          variant={allocation.status === 'READY' ? 'secondary' : 'outline'}
                        >
                          {allocation.stockUnit.assetCode}
                        </Badge>
                      ))}
                    </div>
                    {group.status === 'PREPARING' && (
                      <Button
                        className="mt-4"
                        size="sm"
                        disabled={packing.isPending}
                        onClick={() => packing.mutate(group)}
                      >
                        {packing.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <PackageCheck />
                        )}
                        Complete packing
                      </Button>
                    )}
                    {group.status === 'PLANNED' && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Complete a pre-rental Ready Check for every exact physical item in the
                        inventory workspace.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reviewOpen && version && (
          <div className="flex flex-wrap gap-2">
            <Dialog
              open={approveOpen}
              onOpenChange={(open) => {
                setApproveOpen(open);
                if (!open) resetApprovalAttempt();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  disabled={
                    !operations.review.exactAssignmentComplete || operations.review.holdExpired
                  }
                >
                  <CheckCircle2 />
                  Approve and reserve
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve this exact rental plan?</DialogTitle>
                  <DialogDescription>
                    This freezes version {version}, confirms every inventory reservation, and
                    creates outbound fulfillment groups. Commercial terms and physical custody
                    remain separate records.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="outbound-method">Outbound method</Label>
                    <Select
                      value={outboundMethod}
                      onValueChange={(value) => {
                        setOutboundMethod(value as OutboundMethod);
                        resetApprovalAttempt();
                      }}
                    >
                      <SelectTrigger id="outbound-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COURIER">Courier</SelectItem>
                        <SelectItem value="CUSTOMER_PICKUP">Customer pickup</SelectItem>
                        <SelectItem value="INSTANT_DELIVERY">Instant delivery</SelectItem>
                        <SelectItem value="STAFF_DELIVERY">Staff delivery</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="approval-reason">Review note</Label>
                    <Textarea
                      id="approval-reason"
                      value={approvalReason}
                      onChange={(event) => {
                        setApprovalReason(event.target.value);
                        resetApprovalAttempt();
                      }}
                      placeholder="Availability, customer approval, or exception context"
                    />
                  </div>
                  {problem && (
                    <Alert variant="destructive">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>{problem.message}</AlertTitle>
                      <AlertDescription>{problem.code}</AlertDescription>
                    </Alert>
                  )}
                  <BlockerList blockers={dialogBlockers} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setApproveOpen(false)}>
                    Keep reviewing
                  </Button>
                  <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
                    {approve.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                    Approve version {version}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={renewOpen}
              onOpenChange={(open) => {
                setRenewOpen(open);
                if (open && !renewUntil) {
                  const next = new Date(Date.now() + 30 * 60 * 1000);
                  setRenewUntil(
                    new Date(next.getTime() - next.getTimezoneOffset() * 60_000)
                      .toISOString()
                      .slice(0, 16),
                  );
                }
                if (!open) resetRenewalAttempt();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <RefreshCw />
                  Renew hold
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Renew inventory hold</DialogTitle>
                  <DialogDescription>
                    A renewal creates a new immutable pending booking version and refreshes every
                    active hold together.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="hold-until">Hold until</Label>
                    <Input
                      id="hold-until"
                      type="datetime-local"
                      value={renewUntil}
                      onChange={(event) => {
                        setRenewUntil(event.target.value);
                        resetRenewalAttempt();
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="renew-reason">Reason</Label>
                    <Textarea
                      id="renew-reason"
                      value={renewReason}
                      onChange={(event) => {
                        setRenewReason(event.target.value);
                        resetRenewalAttempt();
                      }}
                    />
                  </div>
                  {problem && (
                    <Alert variant="destructive">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>{problem.message}</AlertTitle>
                      <AlertDescription>{problem.code}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRenewOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={renew.isPending || !renewUntil || !renewReason.trim()}
                    onClick={() => renew.mutate()}
                  >
                    {renew.isPending ? <Loader2 className="animate-spin" /> : <Clock3 />}Renew all
                    holds
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={rejectOpen}
              onOpenChange={(open) => {
                setRejectOpen(open);
                if (!open) resetRejectionAttempt();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <XCircle />
                  Reject request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject this booking request?</DialogTitle>
                  <DialogDescription>
                    The reason is audited, the current version is rejected, and all associated holds
                    and exact assignments are released.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="rejection-reason">Rejection reason</Label>
                    <Textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(event) => {
                        setRejectionReason(event.target.value);
                        resetRejectionAttempt();
                      }}
                      placeholder="Explain why this rental cannot proceed"
                    />
                  </div>
                  {problem && (
                    <Alert variant="destructive">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>{problem.message}</AlertTitle>
                      <AlertDescription>{problem.code}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRejectOpen(false)}>
                    Keep reviewing
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={reject.isPending || !rejectionReason.trim()}
                    onClick={() => reject.mutate()}
                  >
                    {reject.isPending ? <Loader2 className="animate-spin" /> : <XCircle />}Reject
                    and release inventory
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
