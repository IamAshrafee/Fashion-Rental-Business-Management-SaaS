'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { bookingApi } from '@/lib/api/bookings';
import { formatMinorMoney, majorInputToMinor, minorToMajorInput } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ManageDepositModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  itemId: string;
  depositAmount: number;
  depositStatus: string;
  bookingStatus: string;
  damageReport?: {
    id: string;
    deductionAmount: number;
    additionalCharge: number;
  } | null;
  onSuccess?: () => void;
}

export function ManageDepositModal({ isOpen, onOpenChange, itemId, depositAmount, depositStatus, bookingStatus, damageReport, onSuccess }: ManageDepositModalProps) {
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [action, setAction] = useState<'refund' | 'forfeit'>('refund');
  const [refundMethod, setRefundMethod] = useState('bkash');
  const [deduction, setDeduction] = useState(String(minorToMajorInput(damageReport?.deductionAmount ?? 0)));
  const [additionalCharge, setAdditionalCharge] = useState(String(minorToMajorInput(damageReport?.additionalCharge ?? 0)));
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setAction('refund');
    setDeduction(String(minorToMajorInput(damageReport?.deductionAmount ?? 0)));
    setAdditionalCharge(String(minorToMajorInput(damageReport?.additionalCharge ?? 0)));
    setReason(damageReport ? 'Settlement based on the recorded return damage report' : 'Deposit returned after completed rental inspection');
    idempotencyKey.current = crypto.randomUUID();
  }, [damageReport, isOpen]);

  const deductionMinor = majorInputToMinor(deduction) ?? 0;
  const additionalChargeMinor = majorInputToMinor(additionalCharge) ?? 0;
  const refundAmount = Math.max(0, depositAmount - deductionMinor);
  const canSettle = depositStatus === 'held' && bookingStatus === 'inspected';
  const isTerminal = ['refunded', 'partially_refunded', 'forfeited'].includes(depositStatus);
  const evidenceRequired = action === 'forfeit' || deductionMinor > 0 || additionalChargeMinor > 0;

  const mutation = useMutation({
    mutationFn: () => bookingApi.settleDeposit(itemId, {
      forfeit: action === 'forfeit',
      refundAmount: action === 'forfeit' ? 0 : refundAmount,
      deductionAmount: action === 'forfeit' ? 0 : deductionMinor,
      additionalCharge: action === 'forfeit' ? 0 : additionalChargeMinor,
      refundMethod: action === 'refund' && refundAmount > 0 ? refundMethod : undefined,
      reason: reason.trim(),
      damageReportId: damageReport?.id,
    }, idempotencyKey.current),
    onSuccess: () => {
      toast.success(action === 'forfeit' ? 'Deposit forfeiture recorded' : 'Deposit settlement recorded');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to settle deposit'),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[470px]">
        <DialogHeader><DialogTitle>Settle security deposit</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-md bg-muted p-4 text-sm">
            <div><p className="font-medium">Held for this item</p><p className="text-xs capitalize text-muted-foreground">Status: {depositStatus.replace('_', ' ')}</p></div>
            <span className="text-lg font-bold">{formatMinorMoney(depositAmount)}</span>
          </div>

          {isTerminal ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">This item already has a final deposit settlement. A second refund, deduction, or forfeiture is blocked.</p>
          ) : !canSettle ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {depositStatus !== 'held'
                ? 'Record the complete security-deposit amount through a verified booking payment first.'
                : 'Complete the return and inspection workflow before making a final deposit decision.'}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={action} onValueChange={(value) => setAction(value as 'refund' | 'forfeit')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund"><span className="flex items-center gap-2"><Undo2 className="size-4 text-blue-600" />Refund with optional deduction</span></SelectItem>
                    <SelectItem value="forfeit" disabled={!damageReport}><span className="flex items-center gap-2"><Ban className="size-4 text-destructive" />Forfeit full item deposit</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {action === 'refund' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label htmlFor="deposit-deduction">Deduction (৳)</Label><Input id="deposit-deduction" type="number" min={0} max={depositAmount / 100} step="0.01" value={deduction} disabled={!damageReport} onChange={(event) => setDeduction(event.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="additional-charge">Additional charge (৳)</Label><Input id="additional-charge" type="number" min={0} step="0.01" value={additionalCharge} disabled={!damageReport} onChange={(event) => setAdditionalCharge(event.target.value)} /></div>
                  </div>
                  <div className="flex justify-between rounded-md border p-3 text-sm"><span>Customer refund</span><strong>{formatMinorMoney(refundAmount)}</strong></div>
                  {refundAmount > 0 && <div className="space-y-1"><Label>Refund method</Label><Select value={refundMethod} onValueChange={setRefundMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bkash">bKash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank transfer</SelectItem><SelectItem value="cash">Cash</SelectItem></SelectContent></Select></div>}
                </div>
              ) : (
                <p className="rounded-md border-l-4 border-destructive bg-destructive/10 p-4 text-sm">The complete {formatMinorMoney(depositAmount)} will be recorded as forfeited. This final action cannot be repeated.</p>
              )}
              <div className="space-y-1"><Label htmlFor="settlement-reason">Authorized reason *</Label><Textarea id="settlement-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></div>
              {!damageReport && <p className="text-xs text-muted-foreground">Record linked return damage or loss evidence before deducting, forfeiting, or adding a charge. A full refund can proceed without damage evidence.</p>}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          {!isTerminal && canSettle && <Button variant={action === 'forfeit' ? 'destructive' : 'default'} disabled={mutation.isPending || !reason.trim() || deductionMinor > depositAmount || (evidenceRequired && !damageReport)} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}{action === 'forfeit' ? 'Record forfeiture' : `Settle & refund ${formatMinorMoney(refundAmount)}`}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
