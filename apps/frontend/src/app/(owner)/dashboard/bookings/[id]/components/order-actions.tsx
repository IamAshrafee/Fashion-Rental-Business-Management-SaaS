'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BookingStatus } from '../../types';
import {
  Package, Truck, CheckCircle, RotateCcw, XCircle,
  Search, ClipboardCheck, Loader2,
} from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ShipOrderModal } from '../../components/modals/ship-order-modal';

interface OrderActionsProps {
  bookingId: string;
  status: BookingStatus;
}

export function OrderActions({ bookingId, status }: OrderActionsProps) {
  const queryClient = useQueryClient();
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

  const cancelMutation = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId, 'Cancelled by owner'),
    onSuccess: () => { toast.success('Booking cancelled'); invalidate(); setShowCancelConfirm(false); },
    onError: (err: Error) => toast.error(err.message || 'Failed to cancel'),
  });

  const isAnyPending = confirmMutation.isPending || deliverMutation.isPending
    || returnMutation.isPending || inspectMutation.isPending
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
              onClick={() => setShowCancelConfirm(true)}
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
              onClick={() => setShowCancelConfirm(true)}
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
          <ActionButton
            onClick={() => returnMutation.mutate()}
            isPending={returnMutation.isPending}
            icon={RotateCcw}
            label="Mark as Returned"
            className="bg-purple-600 hover:bg-purple-700"
          />
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

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancel this booking?"
        description="This action cannot be undone. The customer will be notified."
        confirmLabel={cancelMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
        variant="destructive"
        onConfirm={() => cancelMutation.mutate()}
      />

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
