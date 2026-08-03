'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookingStatus } from '../../types';
import {
  Truck, CheckCircle, RotateCcw, XCircle,
  Search, ClipboardCheck, Loader2, AlertTriangle, DollarSign,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { bookingApi } from '@/lib/api/bookings';
import { fulfillmentApi } from '@/lib/api/fulfillment';

interface OrderActionsProps {
  bookingId: string;
  status: BookingStatus;
}

export function OrderActions({ bookingId, status }: OrderActionsProps) {
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const fulfillment = useQuery({
    queryKey: ['booking-fulfillment', bookingId],
    queryFn: () => fulfillmentApi.listBookingRequirements(bookingId),
    enabled: status !== 'pending' && status !== 'cancelled' && status !== 'completed',
  });
  const requirements = fulfillment.data || [];
  const handoffReady =
    requirements.length > 0 &&
    requirements.every((requirement) => requirement.handedOutQuantity === requirement.quantity);
  const returnReady =
    requirements.length > 0 &&
    requirements.every(
      (requirement) =>
        requirement.returnedQuantity + requirement.lostQuantity === requirement.quantity,
    );
  const inspectionReady =
    returnReady &&
    requirements.every((requirement) =>
      (requirement.reservation?.assignments || []).every(
        (assignment) =>
          !assignment.releasedAt || assignment.stockUnit.operationalState !== 'AWAITING_INSPECTION',
      ),
    );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['booking-fulfillment', bookingId] });
  };

  const confirmMutation = useMutation({
    mutationFn: () => bookingApi.confirm(bookingId),
    onSuccess: () => { toast.success('Booking confirmed'); invalidate(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to confirm'),
  });

  const deliverMutation = useMutation({
    mutationFn: () => bookingApi.deliver(bookingId),
    onSuccess: () => { toast.success('Marked as delivered'); invalidate(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to mark delivered'),
  });

  const returnMutation = useMutation({
    mutationFn: () => bookingApi.markReturned(bookingId),
    onSuccess: () => { toast.success('Marked as returned'); invalidate(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to mark returned'),
  });

  const inspectMutation = useMutation({
    mutationFn: () => bookingApi.inspect(bookingId),
    onSuccess: () => { toast.success('Inspection completed'); invalidate(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to inspect'),
  });

  const completeMutation = useMutation({
    mutationFn: () => bookingApi.complete(bookingId),
    onSuccess: () => { toast.success('Order completed!'); invalidate(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to complete'),
  });

  // Fix #12: Late fee calculation
  const lateFeeMutation = useMutation({
    mutationFn: () => bookingApi.calculateLateFees(bookingId),
    onSuccess: (result) => {
      if (result.lateItemsUpdated > 0) {
        toast.success(`Late fees updated for ${result.lateItemsUpdated} item(s)`);
      } else {
        toast.info('No late items found — fees are up to date');
      }
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to calculate late fees'),
  });

  // Fix #2: send user-provided reason
  const cancelMutation = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId, cancelReason.trim() || 'Cancelled by owner'),
    onSuccess: () => {
      toast.success('Booking cancelled');
      invalidate();
      setShowCancelDialog(false);
      setCancelReason('');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to cancel'),
  });

  const isAnyPending = confirmMutation.isPending || deliverMutation.isPending
    || returnMutation.isPending || inspectMutation.isPending || lateFeeMutation.isPending
    || completeMutation.isPending || cancelMutation.isPending;

  const ActionButton = ({ onClick, isPending, icon: Icon, label, className, allowed = true }: {
    onClick: () => void;
    isPending: boolean;
    icon: React.ElementType;
    label: string;
    className?: string;
    allowed?: boolean;
  }) => (
    <Button
      onClick={onClick}
      disabled={isAnyPending || !allowed}
      className={className}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icon className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'pending' && (
          <>
            <ActionButton
              onClick={() => confirmMutation.mutate()}
              isPending={confirmMutation.isPending}
              icon={CheckCircle}
              label="Confirm Booking"
              className="bg-blue-600 hover:bg-blue-700"
            />
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              disabled={isAnyPending}
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Booking
            </Button>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <ActionButton
              onClick={() => deliverMutation.mutate()}
              isPending={deliverMutation.isPending}
              icon={Truck}
              label="Finalize Handoff"
              className="bg-teal-600 hover:bg-teal-700"
              allowed={handoffReady}
            />
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              disabled={isAnyPending}
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Order
            </Button>
          </>
        )}

        {(status === 'delivered' || status === 'overdue') && (
          <>
            <ActionButton
              onClick={() => returnMutation.mutate()}
              isPending={returnMutation.isPending}
              icon={RotateCcw}
              label="Finalize Return"
              className="bg-purple-600 hover:bg-purple-700"
              allowed={returnReady}
            />
            {/* Fix #12: Charge Late Fees button for overdue bookings */}
            {status === 'overdue' && (
              <ActionButton
                onClick={() => lateFeeMutation.mutate()}
                isPending={lateFeeMutation.isPending}
                icon={DollarSign}
                label="Charge Late Fees"
                className="bg-amber-600 hover:bg-amber-700"
              />
            )}
          </>
        )}

        {status === 'returned' && (
          <ActionButton
            onClick={() => inspectMutation.mutate()}
            isPending={inspectMutation.isPending}
            icon={Search}
            label="Confirm Inspections Complete"
            className="bg-orange-600 hover:bg-orange-700"
            allowed={inspectionReady}
          />
        )}

        {status === 'inspected' && (
          <ActionButton
            onClick={() => completeMutation.mutate()}
            isPending={completeMutation.isPending}
            icon={ClipboardCheck}
            label="Complete Order"
            className="bg-green-600 hover:bg-green-700"
          />
        )}
      </div>

      {status === 'confirmed' && !handoffReady && (
        <p className="mt-2 text-xs text-muted-foreground">
          Record every component handout in the fulfillment workspace before finalizing delivery.
        </p>
      )}
      {(status === 'delivered' || status === 'overdue') && !returnReady && (
        <p className="mt-2 text-xs text-muted-foreground">
          Record every component as returned or lost before finalizing the return.
        </p>
      )}
      {status === 'returned' && !inspectionReady && (
        <p className="mt-2 text-xs text-muted-foreground">
          Complete the return inspection for every serialized physical item before closing inspection.
        </p>
      )}

      {/* Fix #2: Custom Cancel Dialog with reason textarea */}
      <AlertDialog open={showCancelDialog} onOpenChange={(open) => {
        setShowCancelDialog(open);
        if (!open) setCancelReason('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel this booking?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The customer will be notified and all date blocks will be released.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Cancellation Reason</Label>
            <Textarea
              id="cancel-reason"
              placeholder="e.g. Customer requested cancellation, item damaged, out of stock..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This will be visible in the booking timeline and customer notification.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Keep Booking
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Booking
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
