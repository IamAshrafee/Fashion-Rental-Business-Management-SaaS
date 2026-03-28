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
                Security Deposit (৳)
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
                Cleaning Fee (৳)
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
                        Offer Backup Size
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
                        <FormLabel>Backup Size Fee (৳)</FormLabel>
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
                        Enable Try-On Service
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
                          <FormLabel>Try-on Fee (৳)</FormLabel>
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
                          <FormLabel>Duration (Days)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber || 1)} />
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
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Credit fee towards rental</FormLabel>
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
