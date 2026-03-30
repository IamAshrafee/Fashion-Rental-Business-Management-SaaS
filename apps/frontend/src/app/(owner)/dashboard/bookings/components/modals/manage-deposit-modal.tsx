'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, Undo2, Ban } from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';

interface ManageDepositModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  itemId: string;
  depositAmount: number;
  depositStatus: string;
  onSuccess?: () => void;
}

export function ManageDepositModal({
  isOpen, onOpenChange,
  bookingId: _bookingId, itemId,
  depositAmount, depositStatus,
  onSuccess,
}: ManageDepositModalProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'collect' | 'refund' | 'forfeit'>(
    depositStatus === 'pending' ? 'collect' : 'refund',
  );
  const [refundMethod, setRefundMethod] = useState('bkash');
  const [deduction, setDeduction] = useState('0');
  const [forfeitReason, setForfeitReason] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const parsedDeduction = parseInt(deduction, 10) || 0;
  const refundAmount = Math.max(0, depositAmount - parsedDeduction);

  // ── Collect deposit mutation ──
  const collectMutation = useMutation({
    mutationFn: () => bookingApi.collectDeposit(itemId),
    onSuccess: () => {
      toast.success('Deposit marked as collected');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to collect deposit'),
  });

  // ── Refund deposit mutation ──
  const refundMutation = useMutation({
    mutationFn: () => bookingApi.refundDeposit(itemId, {
      refundAmount,
      refundMethod,
      notes: refundNotes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(
        refundAmount === depositAmount
          ? 'Full deposit refunded'
          : `Partial refund of ৳${refundAmount.toLocaleString()} processed`,
      );
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to refund deposit'),
  });

  // ── Forfeit deposit mutation ──
  const forfeitMutation = useMutation({
    mutationFn: () => bookingApi.forfeitDeposit(itemId, {
      reason: forfeitReason.trim(),
    }),
    onSuccess: () => {
      toast.success('Deposit forfeited');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to forfeit deposit'),
  });

  const isPending = collectMutation.isPending || refundMutation.isPending || forfeitMutation.isPending;

  const handleSubmit = () => {
    if (action === 'collect') collectMutation.mutate();
    else if (action === 'refund') refundMutation.mutate();
    else if (action === 'forfeit') {
      if (!forfeitReason.trim()) {
        toast.error('Forfeit reason is required');
        return;
      }
      forfeitMutation.mutate();
    }
  };

  // Determine available actions based on current deposit status
  const canCollect = depositStatus === 'pending';
  const canRefundOrForfeit = ['collected', 'held'].includes(depositStatus);
  const isTerminal = ['refunded', 'partially_refunded', 'forfeited'].includes(depositStatus);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Manage Deposit</DialogTitle>
        </DialogHeader>
        
        {/* Deposit info */}
        <div className="bg-muted p-4 rounded-md mb-2 flex justify-between items-center text-sm">
          <div>
            <span className="text-muted-foreground font-medium">Deposit Amount</span>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              Status: <span className="font-semibold">{depositStatus.replace('_', ' ')}</span>
            </div>
          </div>
          <span className="font-bold text-lg">৳{depositAmount.toLocaleString()}</span>
        </div>

        {isTerminal ? (
          <div className="text-sm text-muted-foreground p-4 text-center">
            This deposit has already been{' '}
            <span className="font-semibold capitalize">{depositStatus.replace('_', ' ')}</span>.
            No further actions are available.
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            {/* Action selector */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="action" className="text-right text-sm">Action</Label>
              <div className="col-span-3">
                <Select
                  value={action}
                  onValueChange={(v) => setAction(v as 'collect' | 'refund' | 'forfeit')}
                >
                  <SelectTrigger id="action">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {canCollect && (
                      <SelectItem value="collect">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          Mark as Collected
                        </span>
                      </SelectItem>
                    )}
                    {canRefundOrForfeit && (
                      <>
                        <SelectItem value="refund">
                          <span className="flex items-center gap-2">
                            <Undo2 className="h-3.5 w-3.5 text-blue-600" />
                            Refund (Full/Partial)
                          </span>
                        </SelectItem>
                        <SelectItem value="forfeit">
                          <span className="flex items-center gap-2">
                            <Ban className="h-3.5 w-3.5 text-destructive" />
                            Forfeit Entire Deposit
                          </span>
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Collect — simple confirmation */}
            {action === 'collect' && (
              <div className="text-sm bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 rounded-md">
                This will mark the deposit of <strong>৳{depositAmount.toLocaleString()}</strong> as
                collected. Use this when you have confirmed receipt of the deposit payment.
              </div>
            )}

            {/* Refund — amount, method, notes */}
            {action === 'refund' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="deduction" className="text-right text-sm text-destructive font-medium">
                    Deduction (৳)
                  </Label>
                  <Input
                    id="deduction"
                    type="number"
                    placeholder="0"
                    value={deduction}
                    onChange={(e) => setDeduction(e.target.value)}
                    className="col-span-3"
                    min={0}
                    max={depositAmount}
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="refundAmount" className="text-right text-sm text-green-600 font-medium">
                    Refund (৳)
                  </Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    value={refundAmount}
                    disabled
                    className="col-span-3 font-semibold text-lg bg-green-50/50 dark:bg-green-950/20"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4 mt-2">
                  <Label htmlFor="method" className="text-right text-sm">
                    Method
                  </Label>
                  <div className="col-span-3">
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger id="method">
                        <SelectValue placeholder="Refund via..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bkash">Send via bKash</SelectItem>
                        <SelectItem value="nagad">Send via Nagad</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="cash">Hand Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="notes" className="text-right text-sm mt-2">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional remarks..."
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    className="col-span-3 min-h-[60px]"
                  />
                </div>
              </>
            )}

            {/* Forfeit — reason required */}
            {action === 'forfeit' && (
              <>
                <div className="text-sm border-l-4 border-destructive bg-destructive/10 p-4 text-destructive-foreground">
                  You are about to <strong>forfeit the entire deposit of ৳{depositAmount.toLocaleString()}</strong>.
                  <br /><br />
                  This is irreversible. Typically used for severe damage, loss, or breach of rental terms.
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="forfeit-reason" className="text-right text-sm mt-2">
                    Reason *
                  </Label>
                  <Textarea
                    id="forfeit-reason"
                    placeholder="e.g. Item destroyed beyond repair"
                    value={forfeitReason}
                    onChange={(e) => setForfeitReason(e.target.value)}
                    className="col-span-3 min-h-[60px]"
                  />
                </div>
              </>
            )}
          </div>
        )}
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          {!isTerminal && (
            <Button
              onClick={handleSubmit}
              disabled={isPending || (action === 'forfeit' && !forfeitReason.trim())}
              variant={action === 'forfeit' ? 'destructive' : 'default'}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'collect' && 'Confirm Collection'}
              {action === 'refund' && `Process Refund ৳${refundAmount.toLocaleString()}`}
              {action === 'forfeit' && 'Forfeit Deposit'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
