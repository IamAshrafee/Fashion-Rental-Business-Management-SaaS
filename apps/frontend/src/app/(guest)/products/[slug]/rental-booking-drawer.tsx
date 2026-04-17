'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CustomDateRangePicker } from './custom-date-picker';
import { cn } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';
import { Plus, AlertCircle, Loader2, Check, Sparkles, Package, Ruler } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RentalBookingDrawerProps {
  product: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  date: { from: Date | undefined; to: Date | undefined };
  setDate: (d: { from: Date | undefined; to: Date | undefined }) => void;
  uniqueColors: any[];
  selectedColorId: string | null;
  onColorSelect: (colorId: string) => void;
  colorVariants: any[];
  selectedVariantId: string | null;
  onVariantSelect: (variantId: string | null) => void;
  availabilityMutation: any;
  availabilityResult: any;
  addTryOn: boolean;
  setAddTryOn: (val: boolean) => void;
  addBackup: boolean;
  setAddBackup: (val: boolean) => void;
  selectedBackupSize: string;
  setSelectedBackupSize: (val: string) => void;
  days: number;
  effectiveBasePrice: number;
  depositAmount: number;
  totalPrice: number;
  isSizeValid: boolean;
  isFormValid: boolean;
  isAvailable: boolean;
  canAddToCart: boolean;
  handleAddToCart: () => void;
}

export function RentalBookingDrawer({
  product,
  isOpen,
  onOpenChange,
  date,
  setDate,
  uniqueColors,
  selectedColorId,
  onColorSelect,
  colorVariants,
  selectedVariantId,
  onVariantSelect,
  availabilityMutation,
  availabilityResult,
  addTryOn,
  setAddTryOn,
  addBackup,
  setAddBackup,
  selectedBackupSize,
  setSelectedBackupSize,
  days,
  effectiveBasePrice,
  depositAmount,
  totalPrice,
  isSizeValid,
  isFormValid,
  isAvailable,
  canAddToCart,
  handleAddToCart,
}: RentalBookingDrawerProps) {
  const { formatPrice } = useLocale();
  const pricing = product?.pricing;
  const services = product?.services;
  const sizing = product?.sizing;

  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full md:max-w-md xl:max-w-lg overflow-y-auto pb-32 sm:pb-32 px-6">
          <SheetHeader className="mb-6 mt-4">
            <SheetTitle className="text-2xl font-display font-semibold text-left">
              Reserve Your Dates
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-10">
            {/* Pricing Pane */}
            <div className="rounded-2xl bg-neutral-50 px-6 py-5 border border-neutral-100">
              <div className="flex items-end gap-3 tracking-tight">
                <span className="text-4xl font-bold leading-none text-black">
                  {formatPrice(isFormValid ? totalPrice : (effectiveBasePrice + depositAmount))}
                </span>
                {pricing?.includedDays && (
                  <span className="mb-1.5 text-sm font-medium text-muted-foreground">
                    / {pricing.includedDays} days included
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
                {(pricing?.extendedRentalRate || pricing?.pricePerDay) ? (
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-black/40" /> 
                    <strong className="text-black">{formatPrice(pricing.extendedRentalRate || pricing.pricePerDay || 0)}</strong> /extra day
                  </span>
                ) : null}
                {depositAmount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Refundable Deposit: <strong className="text-black">{formatPrice(depositAmount)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black/60">1. Timeline</h3>
              </div>
              <CustomDateRangePicker date={date} setDate={(d) => setDate(d || {from: undefined, to: undefined})} />

              {/* Availability Banner */}
              <AnimatePresence mode="popLayout">
                 {availabilityMutation.isPending && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center gap-3 rounded-xl bg-neutral-50 px-5 py-4 text-sm font-medium text-muted-foreground border border-neutral-100">
                     <Loader2 className="h-4 w-4 animate-spin" /> Verifying dates internally...
                   </motion.div>
                 )}
                 {availabilityResult && isAvailable && days > 0 && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900 border border-emerald-100">
                     <span>Duration: <strong>{days} days</strong></span>
                     <span className="flex items-center gap-1.5"><Check className="h-5 w-5 text-emerald-600" /> Available</span>
                   </motion.div>
                 )}
                 {availabilityResult && !isAvailable && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center gap-3 rounded-xl bg-red-50 px-5 py-4 text-sm font-medium text-red-900 border border-red-100">
                     <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                     Item unavailable for these dates.
                   </motion.div>
                 )}
              </AnimatePresence>
            </div>



            {/* Sizing */}
            {sizing && colorVariants.some(v => v.sizeInstance !== null) && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-black/60">3. Fit & Size</h3>
                  {sizing.sizeCharts && sizing.sizeCharts.length > 0 && (
                    <button onClick={() => setSizeGuideOpen(true)} className="text-xs font-semibold text-black underline underline-offset-4 hover:text-black/70">
                      Size Guide
                    </button>
                  )}
                </div>
                
                {sizing.schema.definition && (sizing.schema.definition as any).ui?.selectorType === 'dropdown' && colorVariants.length > 12 ? (
                  <select 
                    value={selectedVariantId || ''} 
                    onChange={(e) => onVariantSelect(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold focus:border-black focus:ring-1 focus:ring-black"
                  >
                    {colorVariants.map(v => (
                      <option key={v.id} value={v.id}>{v.sizeInstance?.displayLabel}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {colorVariants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => onVariantSelect(v.id)}
                        className={cn(
                          'flex min-w-[3.5rem] items-center justify-center rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-300',
                          selectedVariantId === v.id 
                            ? 'border-black bg-black text-white shadow-md' 
                            : 'border-black/10 bg-white text-black hover:border-black/30'
                        )}
                      >
                        {v.sizeInstance?.displayLabel || 'Default'}
                      </button>
                    ))}
                  </div>
                )}
                
                {!isSizeValid && (
                   <p className="mt-2 text-xs font-medium text-red-500 tracking-wide">
                     Selection required
                   </p>
                )}
              </div>
            )}

            {/* Extra Services */}
            {(services?.tryOnEnabled || services?.backupSizeEnabled) && (
              <div className="space-y-3">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-black/60">4. Premium Additions</h3>
                
                {services?.tryOnEnabled && (
                  <button
                    onClick={() => setAddTryOn(!addTryOn)}
                    className={cn(
                      'w-full text-left flex flex-col gap-2 rounded-2xl border-2 p-5 transition-all duration-300',
                      addTryOn ? 'border-black bg-neutral-50/50 shadow-md' : 'border-transparent bg-neutral-50 hover:bg-neutral-100 hover:border-black/10'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2 font-semibold text-black">
                        <Sparkles className={cn("h-4 w-4", addTryOn ? "text-amber-500" : "text-muted-foreground")} />
                        At-Home Try On
                      </span>
                      <span className="font-bold">+{formatPrice(services.tryOnFee || 0)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      Garment arrives {services.tryOnDurationHours ? `${services.tryOnDurationHours}h` : '24h'} early for sizing test.
                      {services.tryOnCreditToRental && ' Fee is credited back to final rental!'}
                    </p>
                  </button>
                )}

                {services?.backupSizeEnabled && (
                  <div className={cn(
                    'overflow-hidden rounded-2xl border-2 transition-all duration-300',
                    addBackup ? 'border-black bg-neutral-50/50 shadow-md' : 'border-transparent bg-neutral-50 hover:bg-neutral-100 hover:border-black/10'
                  )}>
                    <button
                      onClick={() => setAddBackup(!addBackup)}
                      className="w-full text-left p-5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-2 font-semibold text-black">
                          <Package className={cn("h-4 w-4", addBackup ? "text-amber-500" : "text-muted-foreground")} />
                          Backup Size Insurance
                        </span>
                        <span className="font-bold">+{formatPrice(services.backupSizeFee || 0)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">Skip the stress. We will ship a secondary size for perfect fitting.</p>
                    </button>
                    <AnimatePresence>
                      {addBackup && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-black/10 px-5 pb-5">
                          <div className="pt-4 pl-6">
                            <label className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-3 block">Backup Size Requirement</label>
                            <div className="flex flex-wrap gap-2">
                              {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setSelectedBackupSize(s)}
                                  className={cn("px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all", selectedBackupSize === s ? "border-black bg-white shadow-sm" : "border-transparent bg-black/5 hover:bg-black/10 text-muted-foreground")}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Action Footer inside Sheet */}
          <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-black/5 p-4 shadow-xl">
             <button
               type="button"
               disabled={!canAddToCart}
               onClick={() => {
                 handleAddToCart();
                 onOpenChange(false);
               }}
               className={cn(
                 'relative flex w-full h-14 items-center justify-center overflow-hidden rounded-full font-bold uppercase tracking-widest text-white transition-all',
                 !canAddToCart ? 'bg-black/20 cursor-not-allowed' : 'bg-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20'
               )}
             >
                 {availabilityMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (canAddToCart ? 'Confirm Reservation' : (isSizeValid ? 'Select Dates' : 'Select Size'))}
             </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Size Guide Modal (kept from orig) */}
      {sizeGuideOpen && product?.sizing?.sizeCharts && (
        <Dialog open={sizeGuideOpen} onOpenChange={setSizeGuideOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                Size Guide & Measurements
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-8 max-h-[70vh] overflow-y-auto">
              {product.sizing.sizeCharts.map((chart: any) => (
                <div key={chart.id} className="overflow-x-auto rounded-xl border border-black/5 bg-neutral-50/50">
                  <div className="bg-muted px-4 py-3 border-b border-border">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-black flex items-center gap-2">
                      {chart.title}
                    </h4>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-black/5 bg-black/5">
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Size</th>
                          {chart.rows?.[0] && Object.keys(chart.rows[0].measurements || {}).map(key => (
                            <th key={key} className="px-4 py-3 text-left font-semibold text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.rows?.map((row: any) => (
                          <tr key={row.id} className="border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors">
                            <td className="px-4 py-4 font-bold text-black border-r border-black/5 bg-black/5">{row.sizeLabel}</td>
                            {Object.values(row.measurements || {}).map((val: any, i) => (
                              <td key={i} className="px-4 py-4 font-medium text-black/70">{String(val) || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 rounded-lg bg-orange-50 border border-orange-100 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 font-medium leading-relaxed">
                Measurements refer to body size, not garment dimensions. Need help? Contact our styling team for a personalized recommendation.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
