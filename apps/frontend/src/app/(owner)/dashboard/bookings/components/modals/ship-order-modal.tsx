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
import { Checkbox } from '@/components/ui/checkbox';

interface ShipOrderModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
}

export function ShipOrderModal({ isOpen, onOpenChange, orderId: _orderId, orderNumber }: ShipOrderModalProps) {
  const [courier, setCourier] = useState('pathao');
  const [createParcel, setCreateParcel] = useState(true);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ship Order {orderNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="courier" className="text-right">
              Courier
            </Label>
            <div className="col-span-3">
              <Select value={courier} onValueChange={setCourier}>
                <SelectTrigger id="courier">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pathao">Pathao</SelectItem>
                  <SelectItem value="steadfast">Steadfast</SelectItem>
                  <SelectItem value="manual">Manual / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tracking" className="text-right">
              Tracking
            </Label>
            <Input
              id="tracking"
              placeholder={createParcel ? 'Auto-generated' : 'Enter tracking ID'}
              disabled={createParcel && courier !== 'manual'}
              className="col-span-3"
            />
          </div>

          {courier !== 'manual' && (
            <div className="flex items-center space-x-2 mt-2 ml-[88px]">
              <Checkbox 
                id="create-parcel" 
                checked={createParcel} 
                onCheckedChange={(c) => setCreateParcel(c as boolean)} 
              />
              <label
                htmlFor="create-parcel"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Create parcel via {courier === 'pathao' ? 'Pathao' : 'Steadfast'} API
              </label>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit">Ship & Notify Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
