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

export function PricingStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  const pricingMode = watch('pricingMode');

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
                    <FormLabel>Rental Price (৳) *</FormLabel>
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
                    <FormLabel>Included Days *</FormLabel>
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
                    <FormLabel>Price Per Day (৳) *</FormLabel>
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
                    <FormLabel>Minimum Days *</FormLabel>
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
                    <FormLabel>Retail Value (৳) *</FormLabel>
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
                    <FormLabel>Rental Percentage (%) *</FormLabel>
                    <FormControl>
                      <Input type="number" max="100" min="1" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                    </FormControl>
                    <FormDescription>Calculated automatically for display</FormDescription>
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
                <FormLabel>Minimum Price Floor (৳)</FormLabel>
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
                <FormLabel>Max Discount Amount (৳)</FormLabel>
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
              <FormLabel>Extended Rate per Day (৳)</FormLabel>
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
              <FormLabel>Late Fee Type</FormLabel>
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

        <FormField
          control={control}
          name="lateFeePerDay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Late Fee / Day (৳)</FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={control}
          name="shippingMode"
          render={({ field }) => (
            <FormItem className="col-span-full sm:col-span-1">
              <FormLabel>Shipping Mode</FormLabel>
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
                <FormLabel>Flat Shipping Fee (৳)</FormLabel>
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
