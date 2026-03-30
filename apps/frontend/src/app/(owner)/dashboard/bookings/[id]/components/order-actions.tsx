'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookingStatus } from '../../types';
import {
  Package, Truck, CheckCircle, RotateCcw, XCircle,
  Search, ClipboardCheck, Loader2, AlertTriangle, DollarSign,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { bookingApi } from '@/lib/api/bookings';
import { ShipOrderModal } from '../../components/modals/ship-order-modal';

interface OrderActionsProps {
  bookingId: string;
  status: BookingStatus;
}

export function OrderActions({ bookingId, status }: OrderActionsProps) {
  const queryClient = useQueryClient();
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
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

  const ActionButton = ({ onClick, isPending, icon: Icon, label, className }: {
    onClick: () => void;
    isPending: boolean;
    icon: React.ElementType;
    label: string;
    className?: string;
  }) => (
    <Button
      onClick={onClick}
      disabled={isAnyPending}
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
            <Button onClick={() => setShowShipModal(true)} disabled={isAnyPending}>
              <Package className="mr-2 h-4 w-4" />
              Ship Order
            </Button>
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

        {status === 'shipped' && (
          <ActionButton
            onClick={() => deliverMutation.mutate()}
            isPending={deliverMutation.isPending}
            icon={Truck}
            label="Mark as Delivered"
            className="bg-teal-600 hover:bg-teal-700"
          />
        )}

        {(status === 'delivered' || status === 'overdue') && (
          <>
            <ActionButton
              onClick={() => returnMutation.mutate()}
              isPending={returnMutation.isPending}
              icon={RotateCcw}
              label="Mark as Returned"
              className="bg-purple-600 hover:bg-purple-700"
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
            label="Start Full Inspection"
            className="bg-orange-600 hover:bg-orange-700"
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

      {/* Ship Order Modal */}
      {showShipModal && (
        <ShipOrderModal
          bookingId={bookingId}
          open={showShipModal}
          onOpenChange={setShowShipModal}
          onSuccess={invalidate}
        />
      )}
    </>
  );
}
