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
import { Loader2, UploadCloud } from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';

interface ReportDamageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  itemId: string;
  productName: string;
  variantName: string;
  onSuccess?: () => void;
}

export function ReportDamageModal({
  isOpen, onOpenChange,
  bookingId, itemId,
  productName, variantName,
  onSuccess,
}: ReportDamageModalProps) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState('minor');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('0');

  const mutation = useMutation({
    mutationFn: () => bookingApi.reportDamage(bookingId, itemId, {
      damageLevel: level,
      description: description.trim(),
      estimatedRepairCost: parseInt(cost, 10) || undefined,
    }),
    onSuccess: () => {
      toast.success('Damage report submitted');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      // Reset
      setLevel('minor');
      setDescription('');
      setCost('0');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit damage report');
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Report Damage</DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            {productName} • {variantName}
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
            <Label htmlFor="description" className="text-right text-sm mt-2">Details *</Label>
            <div className="col-span-3">
              <Textarea
                id="description"
                placeholder="Describe the damage..."
                className="h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
        
        <div className="bg-orange-50/50 dark:bg-orange-950/20 p-4 border border-orange-200 dark:border-orange-800 rounded-md -mx-1 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-orange-900 dark:text-orange-300">Total Deduction Recommendation</span>
            <span className="font-bold text-orange-900 dark:text-orange-300 border-b border-orange-300">৳{(parseFloat(cost || '0')).toLocaleString()}</span>
          </div>
          <p className="text-xs text-orange-800/70 dark:text-orange-400/70 mt-2">
             Note: Submitting this report does not automatically deduct from the deposit. You must manually process deposit deductions.
          </p>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !description.trim()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Damage Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
