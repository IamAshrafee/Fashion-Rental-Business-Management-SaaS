'use client';

import { useRef, useState } from 'react';
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
import { Loader2 } from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';
import { formatMinorMoney, majorInputToMinor, minorToMajorInput } from '@/lib/money';
import { getApiErrorMessage } from '@/lib/api-error';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  balanceDue: number;
  depositBalance: number;
  onSuccess?: () => void;
}

export function RecordPaymentModal({ isOpen, onOpenChange, bookingId, balanceDue, depositBalance, onSuccess }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [amount, setAmount] = useState(String(minorToMajorInput(balanceDue)));
  const [depositAmount, setDepositAmount] = useState('0');
  const [method, setMethod] = useState<'cod' | 'bkash' | 'nagad'>('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => bookingApi.recordPayment(bookingId, {
      amount: majorInputToMinor(amount) ?? 0,
      depositAmount: majorInputToMinor(depositAmount) ?? 0,
      method,
      transactionId: transactionId.trim() || undefined,
      notes: notes.trim() || undefined,
    }, idempotencyKey.current),
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      // Reset form
      setAmount(String(minorToMajorInput(balanceDue)));
      setDepositAmount('0');
      setTransactionId('');
      setNotes('');
      idempotencyKey.current = crypto.randomUUID();
      onSuccess?.();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to record payment'));
    },
  });

  const parsedAmountMinor = majorInputToMinor(amount) ?? 0;
  const parsedDepositMinor = majorInputToMinor(depositAmount) ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Balance info */}
          <div className="bg-muted p-3 rounded-md flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Balance Due</span>
            <span className="font-bold text-lg">{formatMinorMoney(balanceDue)}</span>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount (৳)
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3 text-lg font-medium"
              min={1}
              max={balanceDue / 100}
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="depositAmount" className="text-right">Deposit part</Label>
            <div className="col-span-3 space-y-1">
              <Input
                id="depositAmount"
                type="number"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                min={0}
                max={Math.min(balanceDue, depositBalance) / 100}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">Uncollected security deposits: {formatMinorMoney(depositBalance)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="method" className="text-right">
              Method
            </Label>
            <div className="col-span-3">
              <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="cod">Cash (recorded manually)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(method === 'bkash' || method === 'nagad') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="transactionId" className="text-right">
                Txn ID
              </Label>
              <Input
                id="transactionId"
                placeholder="e.g. 9BXX1P7M"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="col-span-3"
              />
              <p className="col-start-2 col-span-3 text-xs text-muted-foreground">
                Required for mobile payments so the receipt can be matched and duplicate entries are blocked.
              </p>
            </div>
          )}

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right mt-2">
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Optional remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3 min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || parsedAmountMinor <= 0 || parsedAmountMinor > balanceDue || parsedDepositMinor > parsedAmountMinor || parsedDepositMinor > depositBalance || parsedAmountMinor - parsedDepositMinor > balanceDue - depositBalance || ((method === 'bkash' || method === 'nagad') && !transactionId.trim())}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record {formatMinorMoney(parsedAmountMinor)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
