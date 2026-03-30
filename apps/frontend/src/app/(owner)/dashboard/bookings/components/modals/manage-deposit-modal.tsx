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
import { Loader2 } from 'lucide-react';
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
  bookingId, itemId: _itemId,
  depositAmount, depositStatus,
  onSuccess,
}: ManageDepositModalProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState('refund');
  const [method, setMethod] = useState('bkash');
  const [deduction, setDeduction] = useState('0');

  const parsedDeduction = parseFloat(deduction) || 0;
  const refundAmount = Math.max(0, depositAmount - parsedDeduction);

  // We record the deposit refund as a negative payment (refund) via the payment endpoint
  const mutation = useMutation({
    mutationFn: () => {
      if (action === 'forfeit') {
        // Record as a note — forfeiting the entire deposit
        return bookingApi.addNote(bookingId, `Deposit of ৳${depositAmount.toLocaleString()} forfeited.`);
      }
      // Record the refund as a payment note with refund details
      return bookingApi.addNote(
        bookingId,
        `Deposit refund processed: ৳${refundAmount.toLocaleString()} via ${method}${parsedDeduction > 0 ? ` (৳${parsedDeduction.toLocaleString()} deducted for damages)` : ''}.`,
      );
    },
    onSuccess: () => {
      toast.success(action === 'forfeit' ? 'Deposit forfeited' : 'Deposit refund recorded');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      setAction('refund');
      setDeduction('0');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to process deposit');
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Deposit</DialogTitle>
        </DialogHeader>
        
        <div className="bg-muted p-4 rounded-md mb-2 flex justify-between items-center text-sm">
          <div>
            <span className="text-muted-foreground font-medium">Collected Deposit</span>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">Status: {depositStatus}</div>
          </div>
          <span className="font-bold text-lg">৳{depositAmount.toLocaleString()}</span>
        </div>
        
        <div className="grid gap-4 py-2">
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="action" className="text-right text-sm">Action</Label>
            <div className="col-span-3">
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund">Refund (Full/Partial)</SelectItem>
                  <SelectItem value="forfeit">Forfeit Entire Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                  <Select value={method} onValueChange={setMethod}>
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
            </>
          )}

          {action === 'forfeit' && (
             <div className="text-sm border-l-4 border-destructive bg-destructive/10 p-4 text-destructive-foreground col-span-4 mt-2">
               You are selecting to <strong>forfeit the entire deposit of ৳{depositAmount.toLocaleString()}</strong>.
               <br/><br/>
               If damages exceed this amount, you will need to charge the customer additionally.
             </div>
          )}
          
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            variant={action === 'forfeit' ? 'destructive' : 'default'}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === 'forfeit' ? 'Forfeit Deposit' : `Process Refund ৳${refundAmount.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
