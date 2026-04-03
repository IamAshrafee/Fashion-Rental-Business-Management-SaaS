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
import { FieldTip } from '@/components/shared/field-tip';

export function PricingStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  const pricingMode = watch('pricingMode');
  const lateFeeType = watch('lateFeeType');
  const retailPrice = watch('retailPrice');
  const rentalPercentage = watch('rentalPercentage');

  // Real-time calculated price for percentage mode
  const calculatedPrice = pricingMode === 'percentage' && retailPrice && rentalPercentage
    ? Math.round(retailPrice * (rentalPercentage / 100))
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Pricing & Logistics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how customers pay for renting this product.
        </p>
      </div>

      <FormField
        control={control}
        name="pricingMode"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Pricing Mode *</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className="flex flex-col space-y-1 sm:flex-row sm:space-x-4 sm:space-y-0"
              >
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50 flex-1">
                  <FormControl>
                    <RadioGroupItem value="one_time" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">One-Time Rental</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50 flex-1">
                  <FormControl>
                    <RadioGroupItem value="per_day" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Per Day</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50 flex-1">
                  <FormControl>
                    <RadioGroupItem value="percentage" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">% of Retail</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {pricingMode === 'one_time' && 'One-Time Rental Configuration'}
            {pricingMode === 'per_day' && 'Per Day Configuration'}
            {pricingMode === 'percentage' && 'Percentage Configuration'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pricingMode === 'one_time' && (
            <>
              <FormField
                control={control}
                name="rentalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rental Price (৳) * <FieldTip tip="The total flat price charged for one rental period. This is the amount the customer pays upfront." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
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
                    <FormLabel>Included Days * <FieldTip tip="How many days the customer gets with this rental. After this, late fees or extended rates apply." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
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
                    <FormLabel>Price Per Day (৳) * <FieldTip tip="The daily rental rate. The total price is calculated as: price per day × number of rental days." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
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
                    <FormLabel>Minimum Days * <FieldTip tip="The minimum number of days a customer must rent this product. Prevents very short bookings." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || 1)} />
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
                    <FormLabel>Retail Value (৳) * <FieldTip tip="The original retail/market value of this item. Used to calculate rental price as a percentage of retail." /></FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
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
                    <FormLabel>Rental Percentage (%) * <FieldTip tip="What percentage of the retail value to charge for rental. E.g., 15% of a ৳20,000 item = ৳3,000 rental." /></FormLabel>
                    <FormControl>
                      <Input type="number" max="100" min="1" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
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
                    <FormLabel>Included Days *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Real-time calculated price preview */}
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
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-4">Internal Pricing (Visible only to staff)</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={control}
            name="minPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Price Floor (৳) <FieldTip tip="The absolute lowest price you’ll accept for this product. Prevents discounts from going below your comfort level. Staff-only — never shown to customers." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                </FormControl>
                <FormDescription>Absolute lowest price allowed.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="maxDiscount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Discount Amount (৳) <FieldTip tip="The maximum discount (in ৳) that can be applied to this product. Prevents over-discounting during promotions." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-full">
          <h3 className="text-lg font-medium mb-4">Timing & Logistics</h3>
        </div>

        <FormField
          control={control}
          name="extendedRentalRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Extended Rate per Day (৳) <FieldTip tip="If a customer wants extra days beyond the included period, this is the per-day rate they pay upfront during booking." /></FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
              </FormControl>
              <FormDescription>Fee for booking extra days upfront.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={control}
          name="lateFeeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Late Fee Type <FieldTip tip="How late fees are calculated. Fixed = a flat ৳ amount per day. Percentage = a % of the rental price per day." /></FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex space-x-2"
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="fixed" /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Fixed</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
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
                <FormLabel>Late Fee per Day (৳) <FieldTip tip="A flat amount charged for each day the item is returned late." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                </FormControl>
                <FormDescription>Fixed amount charged per extra day.</FormDescription>
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
                <FormLabel>Late Fee Percentage (%/day) <FieldTip tip="Percentage of the rental price charged per day late. E.g., 5% of a ৳3,000 rental = ৳150/day." /></FormLabel>
                <FormControl>
                  <Input type="number" max="100" min="0.1" step="0.1" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                </FormControl>
                <FormDescription>Percentage of rental price charged per extra day.</FormDescription>
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
              <FormLabel>Max Late Fee Cap (৳) <FieldTip tip="The maximum total late fee regardless of how many days late. Prevents the total from exceeding the product’s value." /></FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
              </FormControl>
              <FormDescription>Maximum total late fee, regardless of days.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={control}
          name="shippingMode"
          render={({ field }) => (
            <FormItem className="col-span-full sm:col-span-1">
              <FormLabel>Shipping Mode <FieldTip tip="Free = you cover shipping. Flat = a fixed fee added to the order. Area-based = calculated by delivery zone." /></FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex space-x-2"
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="free" /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Free</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="flat" /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Flat</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="area_based" /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Area based</FormLabel>
                  </FormItem>
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
              <FormItem className="col-span-full sm:col-span-1">
                <FormLabel>Flat Shipping Fee (৳) <FieldTip tip="A fixed shipping fee added to every order for this product, regardless of location." /></FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

    </div>
  );
}
