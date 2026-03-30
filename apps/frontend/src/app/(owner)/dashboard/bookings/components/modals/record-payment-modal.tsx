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
import { Loader2 } from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  balanceDue: number;
  onSuccess?: () => void;
}

export function RecordPaymentModal({ isOpen, onOpenChange, bookingId, balanceDue, onSuccess }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(balanceDue));
  const [method, setMethod] = useState('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => bookingApi.recordPayment(bookingId, {
      amount: parseInt(amount, 10) || 0,
      method,
      transactionId: transactionId.trim() || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      // Reset form
      setAmount(String(balanceDue));
      setTransactionId('');
      setNotes('');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record payment');
    },
  });

  const parsedAmount = parseInt(amount, 10) || 0;

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
            <span className="font-bold text-lg">৳{balanceDue.toLocaleString()}</span>
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
              max={balanceDue}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="method" className="text-right">
              Method
            </Label>
            <div className="col-span-3">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="cod">Cash</SelectItem>
                  <SelectItem value="sslcommerz">Card / SSLCommerz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(method === 'bkash' || method === 'nagad' || method === 'sslcommerz') && (
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
            disabled={mutation.isPending || parsedAmount <= 0}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record ৳{parsedAmount.toLocaleString()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
