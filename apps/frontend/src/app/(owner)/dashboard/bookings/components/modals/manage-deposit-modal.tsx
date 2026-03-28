'use client';

import { useState } from 'react';
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

interface ManageDepositModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: number;
}

export function ManageDepositModal({ isOpen, onOpenChange, depositAmount }: ManageDepositModalProps) {
  const [action, setAction] = useState('refund');
  const [method, setMethod] = useState('bKash');
  const [deduction, setDeduction] = useState('0');

  const parsedDeduction = parseFloat(deduction) || 0;
  const refundAmount = Math.max(0, depositAmount - parsedDeduction);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Deposit</DialogTitle>
        </DialogHeader>
        
        <div className="bg-muted p-4 rounded-md mb-2 flex justify-between items-center text-sm">
          <span className="text-muted-foreground font-medium">Collected Deposit:</span>
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
                  className="col-span-3 font-semibold text-lg bg-green-50/50"
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
                      <SelectItem value="bKash">Send via bKash</SelectItem>
                      <SelectItem value="Nagad">Send via Nagad</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant={action === 'forfeit' ? 'destructive' : 'default'}>
            {action === 'forfeit' ? 'Forfeit Deposit' : 'Process Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
