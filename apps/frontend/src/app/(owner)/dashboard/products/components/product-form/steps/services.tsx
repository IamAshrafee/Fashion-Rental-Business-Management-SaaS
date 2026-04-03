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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Shield, Sparkles, HelpCircle, Truck, Ruler } from 'lucide-react';
import { FieldTip } from '@/components/shared/field-tip';

export function ServicesStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  const enableBackupSize = watch('enableBackupSize');
  const enableTryOn = watch('enableTryOn');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Services & Protection</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure deposits, cleaning fees, and advanced rental services.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="securityDeposit"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Security Deposit (৳) <FieldTip tip="A refundable amount held during the rental period. Returned after the item passes inspection. Protects you from damage or loss." />
              </FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
              </FormControl>
              <FormDescription>
                Refundable amount held to cover potential damages.
              </FormDescription>
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
                Cleaning Fee (৳) <FieldTip tip="A non-refundable fee to cover professional dry-cleaning after each rental. Added to the customer's total at checkout." />
              </FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
              </FormControl>
              <FormDescription>
                Non-refundable fee for dry-cleaning after rental.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-6">
        <h3 className="text-lg font-medium">Add-on Services</h3>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <FormField
                control={control}
                name="enableBackupSize"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        Offer Backup Size <FieldTip tip="Let customers rent the same item in a second size for a small fee. They try both, keep the one that fits, and return the other." />
                      </FormLabel>
                      <FormDescription>
                        Allow customers to rent a second size of the same item for a small fee.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
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
                        <FormLabel>Backup Size Fee (৳) <FieldTip tip="The extra fee charged for sending a second size. Should cover the additional shipping and handling cost." /></FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <FormField
                control={control}
                name="enableTryOn"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        Enable Try-On Service <FieldTip tip="Send the item to the customer a few days before their event for a short try-on. Helps ensure fit and satisfaction before the actual rental." />
                      </FormLabel>
                      <FormDescription>
                        Send the item for a short try-on period before the actual event.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
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
                          <FormLabel>Try-on Fee (৳) <FieldTip tip="Fee charged for the try-on service. This covers the extra shipping and handling for the pre-event delivery." /></FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} />
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
                          <FormLabel>Try-on Period (Days) <FieldTip tip="How many days the customer keeps the item during the try-on window before they must return or confirm booking." /></FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} onChange={e => field.onChange(e.target.valueAsNumber || 1)} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            How many days the customer has for try-on.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={control}
                    name="creditTryOnFee"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Credit fee towards rental <FieldTip tip="If the customer decides to book after trying on, the try-on fee is deducted from their rental total — making the try-on essentially free." /></FormLabel>
                          <FormDescription className="text-xs">
                            If they book, the try-on fee is deducted from their final total.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
