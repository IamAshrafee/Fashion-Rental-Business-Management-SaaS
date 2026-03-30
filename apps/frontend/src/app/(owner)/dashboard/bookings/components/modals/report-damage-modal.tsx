'use client';

import { useState, useRef, useCallback } from 'react';
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
import { Loader2, UploadCloud, X, ImageIcon } from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';
import Image from 'next/image';

interface ReportDamageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  itemId: string;
  productName: string;
  variantName: string;
  depositAmount: number;
  onSuccess?: () => void;
}

const MAX_PHOTOS = 4;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface PhotoPreview {
  file: File;
  previewUrl: string;
}

export function ReportDamageModal({
  isOpen, onOpenChange,
  bookingId, itemId,
  productName, variantName,
  depositAmount,
  onSuccess,
}: ReportDamageModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [level, setLevel] = useState('minor');
  const [description, setDescription] = useState('');
  const [repairCost, setRepairCost] = useState('0');
  const [deduction, setDeduction] = useState('0');
  const [additionalCharge, setAdditionalCharge] = useState('0');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);

  const parsedRepairCost = parseInt(repairCost, 10) || 0;
  const parsedDeduction = parseInt(deduction, 10) || 0;
  const parsedAdditional = parseInt(additionalCharge, 10) || 0;

  // Auto-suggest deduction from repair cost (capped at deposit)
  const handleRepairCostChange = (val: string) => {
    setRepairCost(val);
    const cost = parseInt(val, 10) || 0;
    const autoDeduction = Math.min(cost, depositAmount);
    const autoAdditional = Math.max(0, cost - depositAmount);
    setDeduction(String(autoDeduction));
    setAdditionalCharge(String(autoAdditional));
  };

  // ── Photo handling ──────────────────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_PHOTOS - photos.length;
    const selected = Array.from(files).slice(0, remaining);

    const invalid = selected.filter((f) => !ACCEPTED_TYPES.includes(f.type));
    if (invalid.length > 0) {
      toast.error('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    const newPreviews: PhotoPreview[] = selected.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPreviews]);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [photos.length]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── Submit: upload photos first, then report damage ─────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      // Step 1: Upload photos to MinIO (if any)
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        photoUrls = await bookingApi.uploadDamagePhotos(
          itemId,
          photos.map((p) => p.file),
        );
      }

      // Step 2: Submit damage report with photo URLs
      await bookingApi.reportDamage(bookingId, itemId, {
        damageLevel: level,
        description: description.trim(),
        estimatedRepairCost: parsedRepairCost || undefined,
        deductionAmount: parsedDeduction,
        additionalCharge: parsedAdditional,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Damage report submitted');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit damage report');
    },
  });

  const resetForm = () => {
    setLevel('minor');
    setDescription('');
    setRepairCost('0');
    setDeduction('0');
    setAdditionalCharge('0');
    // Revoke all preview URLs
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
                value={repairCost}
                onChange={(e) => handleRepairCostChange(e.target.value)}
                min={0}
              />
            </div>
          </div>

          {/* Deduction from deposit */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deduction" className="text-right text-sm text-destructive font-medium">
              Deposit Deduction (৳)
            </Label>
            <div className="col-span-3">
              <Input
                id="deduction"
                type="number"
                placeholder="0"
                value={deduction}
                onChange={(e) => setDeduction(e.target.value)}
                min={0}
                max={depositAmount}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Customer&apos;s deposit: ৳{depositAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Additional charge beyond deposit */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="additional" className="text-right text-sm text-orange-600 font-medium">
              Additional Charge (৳)
            </Label>
            <div className="col-span-3">
              <Input
                id="additional"
                type="number"
                placeholder="0"
                value={additionalCharge}
                onChange={(e) => setAdditionalCharge(e.target.value)}
                min={0}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Extra amount to charge if repair cost exceeds deposit
              </p>
            </div>
          </div>

          {/* Photo upload — wired to MinIO */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right text-sm mt-3">Photos</Label>
            <div className="col-span-3 space-y-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Photo previews */}
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-md overflow-hidden border bg-muted group"
                    >
                      <Image
                        src={photo.previewUrl}
                        alt={`Damage photo ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area */}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mutation.isPending}
                  className="w-full border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors bg-card disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {photos.length === 0 ? (
                    <UploadCloud className="h-7 w-7 mb-1.5 opacity-70" />
                  ) : (
                    <ImageIcon className="h-5 w-5 mb-1 opacity-70" />
                  )}
                  <span className="text-sm font-medium">
                    {photos.length === 0 ? 'Click to upload photos' : 'Add more photos'}
                  </span>
                  <span className="text-xs opacity-70 mt-0.5">
                    {photos.length}/{MAX_PHOTOS} • JPG, PNG, WebP
                  </span>
                </button>
              )}
            </div>
          </div>
          
        </div>
        
        {/* Summary */}
        <div className="bg-orange-50/50 dark:bg-orange-950/20 p-4 border border-orange-200 dark:border-orange-800 rounded-md -mx-1 mb-2">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-orange-900 dark:text-orange-300">Deposit Deduction</span>
              <span className="font-semibold text-destructive">−৳{parsedDeduction.toLocaleString()}</span>
            </div>
            {parsedAdditional > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-orange-900 dark:text-orange-300">Additional Charge</span>
                <span className="font-semibold text-orange-600">+৳{parsedAdditional.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm pt-1 border-t border-orange-200 dark:border-orange-700 mt-1">
              <span className="font-medium text-orange-900 dark:text-orange-300">Total Customer Impact</span>
              <span className="font-bold text-orange-900 dark:text-orange-300">
                ৳{(parsedDeduction + parsedAdditional).toLocaleString()}
              </span>
            </div>
          </div>
          <p className="text-xs text-orange-800/70 dark:text-orange-400/70 mt-2">
            Note: This creates a damage record and sets deduction amounts. Use &quot;Manage Deposit&quot; to process the actual refund.
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
