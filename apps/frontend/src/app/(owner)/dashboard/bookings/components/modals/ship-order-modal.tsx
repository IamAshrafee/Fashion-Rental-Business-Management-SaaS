'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { fulfillmentApi } from '@/lib/api/fulfillment';

interface ShipOrderModalProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ShipOrderModal({ bookingId, open, onOpenChange, onSuccess }: ShipOrderModalProps) {
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const mutation = useMutation({
    mutationFn: () => fulfillmentApi.ship(bookingId, {
      courierProvider: courier as any,
      useApi: ['pathao', 'steadfast'].includes(courier),
      trackingNumber: ['pathao', 'steadfast'].includes(courier) ? undefined : (trackingNumber.trim() || undefined),
    }),
    onSuccess: () => {
      toast.success('Order shipped! Customer will be notified.');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to ship order');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ship Order</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courier">Courier Provider</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger id="courier">
                <SelectValue placeholder="Select a courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pathao">Pathao</SelectItem>
                <SelectItem value="steadfast">Steadfast</SelectItem>
                <SelectItem value="sa_paribahan">SA Paribahan</SelectItem>
                <SelectItem value="sundarban">Sundarban</SelectItem>
                <SelectItem value="manual">Hand Delivery / Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          
          {!['pathao', 'steadfast'].includes(courier) && (
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number (Optional)</Label>
              <Input
                id="tracking"
                placeholder="e.g. PTH-123456"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ship & Notify Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
