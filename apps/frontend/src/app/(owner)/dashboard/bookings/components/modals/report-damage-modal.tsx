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
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud } from 'lucide-react';
import { BookingItem } from '../../types';

interface ReportDamageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: BookingItem;
}

export function ReportDamageModal({ isOpen, onOpenChange, item }: ReportDamageModalProps) {
  const [level, setLevel] = useState('minor');
  const [cost, setCost] = useState('0');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Report Damage</DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            {item.productName} • {item.variantName}
          </div>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="level" className="text-right text-sm">Level</Label>
            <div className="col-span-3">
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="level">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor (Small stain, loose thread)</SelectItem>
                  <SelectItem value="moderate">Moderate (Visible tear, needs cleaning)</SelectItem>
                  <SelectItem value="severe">Severe (Major damage, requires repair)</SelectItem>
                  <SelectItem value="destroyed">Destroyed (Unusable)</SelectItem>
                  <SelectItem value="lost">Lost (Not returned)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right text-sm mt-2">Details</Label>
            <div className="col-span-3">
              <Textarea
                id="description"
                placeholder="Describe the damage..."
                className="h-20"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cost" className="text-right text-sm">Est. Repair (৳)</Label>
            <div className="col-span-3">
              <Input
                id="cost"
                type="number"
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right text-sm mt-3">Photos</Label>
            <div className="col-span-3">
              <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors bg-card">
                <UploadCloud className="h-8 w-8 mb-2 opacity-70" />
                <span className="text-sm font-medium">Click to upload photos</span>
                <span className="text-xs opacity-70 mt-1">Up to 4 images (JPG, PNG)</span>
              </div>
            </div>
          </div>
          
        </div>
        
        <div className="bg-orange-50/50 p-4 border border-orange-100 rounded-md -mx-1 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-orange-900">Total Deduction Recommendation</span>
            <span className="font-bold text-orange-900 border-b border-orange-300">৳{parseFloat(cost || '0').toLocaleString()}</span>
          </div>
          <p className="text-xs text-orange-800/70 mt-2">
             Note: Submitting this report does not automatically deduct from the deposit. You must manually process deposit deductions.
          </p>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit">Submit Damage Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
