'use client';

import { useFormContext } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { FieldTip } from '@/components/shared/field-tip';
import { Shield, Sparkles, Ruler, Truck, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/* ─── Collapsible Section ──────────────────────────────────────────────── */
function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg min-h-[48px]"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          <span className="font-medium">{title}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */
export function PricingServicesStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  const pricingMode = watch('pricingMode');
  const lateFeeType = watch('lateFeeType');
  const retailPrice = watch('retailPrice');
  const rentalPercentage = watch('rentalPercentage');
  const enableBackupSize = watch('enableBackupSize');
  const enableTryOn = watch('enableTryOn');

  // Real-time calculated price for percentage mode
  const calculatedPrice = pricingMode === 'percentage' && retailPrice && rentalPercentage
    ? Math.round(retailPrice * (rentalPercentage / 100))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Pricing & Fees</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set rental pricing and configure protection fees and add-on services.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION A — Rental Pricing                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section title="Rental Pricing" defaultOpen={true}>
        <FormField
          control={control}
          name="pricingMode"
          render={({ field }) => (
            <FormItem className="space-y-3 mb-6">
              <FormLabel>Pricing Mode * <FieldTip tip="Choose how rental pricing is calculated for this product." /></FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1 sm:flex-row sm:space-x-3 sm:space-y-0"
                >
                  {[
                    { value: 'one_time', label: 'One-Time Rental' },
                    { value: 'per_day', label: 'Per Day' },
                    { value: 'percentage', label: '% of Retail' },
                  ].map((opt) => (
                    <FormItem key={opt.value} className="flex items-center space-x-3 space-y-0 border p-3 sm:p-4 rounded-md cursor-pointer hover:bg-muted/50 flex-1 min-h-[48px]">
                      <FormControl>
                        <RadioGroupItem value={opt.value} />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">{opt.label}</FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pricingMode === 'one_time' && (
            <>
              <FormField
                control={control}
                name="rentalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rental Price (৳) * <FieldTip tip="The total flat price charged for one rental period." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="includedDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Included Days * <FieldTip tip="How many days the customer gets with this rental." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {pricingMode === 'per_day' && (
            <>
              <FormField
                control={control}
                name="pricePerDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Per Day (৳) * <FieldTip tip="The daily rental rate." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="minimumDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Days * <FieldTip tip="Minimum number of days a customer must rent." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || 1)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {pricingMode === 'percentage' && (
            <>
              <FormField
                control={control}
                name="retailPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retail Value (৳) * <FieldTip tip="The original retail/market value of this item." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="rentalPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rental Percentage (%) * <FieldTip tip="What percentage of retail value to charge." /></FormLabel>
                    <FormControl>
                      <Input type="number" max={100} min={1} {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="includedDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Included Days * <FieldTip tip="How many days the customer gets with this rental." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {calculatedPrice !== null && (
                <div className="col-span-full p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide mb-1">
                    Calculated Rental Price
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    ৳{calculatedPrice.toLocaleString()}
                  </div>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                    {rentalPercentage}% of ৳{retailPrice?.toLocaleString()} retail value
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION B — Timing & Late Fees                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section title="Timing & Late Fees" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={control}
            name="extendedRentalRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extended Rate/Day (৳) <FieldTip tip="Per-day rate for extra days booked upfront." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="lateFeeType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Late Fee Type <FieldTip tip="Fixed = flat ৳/day. Percentage = % of rental price/day." /></FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-3 mt-2"
                  >
                    <FormItem className="flex items-center space-x-2 space-y-0 min-h-[44px]">
                      <FormControl><RadioGroupItem value="fixed" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer">Fixed</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0 min-h-[44px]">
                      <FormControl><RadioGroupItem value="percentage" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer">Percentage</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {lateFeeType === 'fixed' && (
            <FormField
              control={control}
              name="lateFeePerDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Late Fee/Day (৳) <FieldTip tip="A flat amount charged per extra day." /></FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {lateFeeType === 'percentage' && (
            <FormField
              control={control}
              name="lateFeePercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Late Fee (%/day) <FieldTip tip="Percentage of rental price charged per day late." /></FormLabel>
                  <FormControl>
                    <Input type="number" max={100} min={0.1} step={0.1} {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={control}
            name="maxLateFeeCap"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Late Fee Cap (৳) <FieldTip tip="Maximum total late fee, regardless of days." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION C — Shipping                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section title="Shipping" icon={Truck} defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="shippingMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipping Mode <FieldTip tip="Free = you cover shipping. Flat = fixed fee. Area-based = by zone." /></FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-3 mt-2"
                  >
                    {['free', 'flat', 'area_based'].map((val) => (
                      <FormItem key={val} className="flex items-center space-x-2 space-y-0 min-h-[44px]">
                        <FormControl><RadioGroupItem value={val} /></FormControl>
                        <FormLabel className="font-normal cursor-pointer capitalize">{val.replace('_', ' ')}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {watch('shippingMode') === 'flat' && (
            <FormField
              control={control}
              name="flatShippingFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flat Shipping Fee (৳) <FieldTip tip="Fixed shipping fee per order." /></FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION D — Internal Pricing                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section title="Internal Pricing (Staff Only)" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="minPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Price Floor (৳) <FieldTip tip="Absolute lowest price allowed." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="maxDiscount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Discount (৳) <FieldTip tip="Maximum discount during promotions." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>

      <Separator />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION E — Protection & Services                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Protection & Services</h3>
      </div>

      <Section title="Security & Cleaning" icon={Shield} defaultOpen={true}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="securityDeposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Security Deposit (৳) <FieldTip tip="Refundable amount held to cover potential damages." />
                </FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="cleaningFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Cleaning Fee (৳) <FieldTip tip="Non-refundable fee for dry-cleaning after rental." />
                </FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>

      <Section title="Backup Size" icon={Ruler} defaultOpen={false}>
        <div className="space-y-4">
          <FormField
            control={control}
            name="enableBackupSize"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 min-h-[56px]">
                <div className="space-y-0.5">
                  <FormLabel>Offer Backup Size <FieldTip tip="Let customers rent a second size for a small fee." /></FormLabel>
                  <FormDescription className="text-xs">
                    Send a second size so the customer can try both.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {enableBackupSize && (
            <div className="pl-4 border-l-2 ml-2">
              <FormField
                control={control}
                name="backupSizeFee"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Backup Size Fee (৳) <FieldTip tip="Extra fee for the second size." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      </Section>

      <Section title="Try-On Service" icon={Truck} defaultOpen={false}>
        <div className="space-y-4">
          <FormField
            control={control}
            name="enableTryOn"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 min-h-[56px]">
                <div className="space-y-0.5">
                  <FormLabel>Enable Try-On <FieldTip tip="Send the item for a short try-on before the actual event." /></FormLabel>
                  <FormDescription className="text-xs">
                    Pre-event try-on service for customer satisfaction.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {enableTryOn && (
            <div className="pl-4 border-l-2 ml-2 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                <FormField
                  control={control}
                  name="tryOnFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Try-on Fee (৳) <FieldTip tip="Fee for the try-on service." /></FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="tryOnDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Try-on Period (Days) <FieldTip tip="Days the customer has for try-on." /></FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} onChange={e => field.onChange(e.target.valueAsNumber || 1)} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={control}
                name="creditTryOnFee"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 min-h-[44px]">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Credit fee towards rental <FieldTip tip="If booked, the try-on fee is deducted from the total." /></FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
