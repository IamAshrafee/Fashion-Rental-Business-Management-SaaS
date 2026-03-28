import { useFormContext, useFieldArray } from 'react-hook-form';
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
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Plus, Trash2 } from 'lucide-react';

export function SizeStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  const sizeMode = watch('sizeMode');
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'measurements',
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Sizing & Measurements</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Specify how this product is sized and provide exact measurements.
        </p>
      </div>

      <FormField
        control={control}
        name="sizeMode"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Size Mode</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50">
                  <FormControl><RadioGroupItem value="standard" /></FormControl>
                  <FormLabel className="font-normal cursor-pointer">Standard Size (S, M, L)</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50">
                  <FormControl><RadioGroupItem value="measurement" /></FormControl>
                  <FormLabel className="font-normal cursor-pointer">Measurement (36, 40)</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50">
                  <FormControl><RadioGroupItem value="multi_part" /></FormControl>
                  <FormLabel className="font-normal cursor-pointer">Multi-part</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0 border p-4 rounded-md cursor-pointer hover:bg-muted/50">
                  <FormControl><RadioGroupItem value="free" /></FormControl>
                  <FormLabel className="font-normal cursor-pointer">Free Size / Adjustable</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Why measurements matter</AlertTitle>
        <AlertDescription>
          Precise measurements reduce returns and try-on failures by 40%. Even for standard sized items, specifying exact dimensions like &quot;Chest: 38 inch&quot; builds trust.
        </AlertDescription>
      </Alert>

      <div>
        <h3 className="text-lg font-medium mb-4">Exact Measurements</h3>
        
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-4">
              <FormField
                control={control}
                name={`measurements.${index}.label`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Body Part (e.g. Chest)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`measurements.${index}.value`}
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Value" 
                        {...field} 
                        onChange={e => field.onChange(e.target.valueAsNumber || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`measurements.${index}.unit`}
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormControl>
                      <Input placeholder="inch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => append({ label: '', value: 0, unit: 'inch' })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Measurement
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Size Chart Reference</h3>
        <FormField
          control={control}
          name="sizeChartUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Size Chart Image URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/chart.png" {...field} />
              </FormControl>
              <FormDescription>
                A link to an external image showing your general sizing guide.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

    </div>
  );
}
