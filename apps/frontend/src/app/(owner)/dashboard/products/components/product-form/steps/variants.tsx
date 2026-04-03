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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useColors } from '../../../hooks/use-product-apis';
import { FieldTip } from '@/components/shared/field-tip';

export function VariantsStep() {
  const { control, watch, setValue } = useFormContext<ProductFormValues>();
  const { data: colors, isLoading: isLoadingColors } = useColors();
  const COLORS = colors || [];
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Color Variants</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add at least one color variant for this product. You&apos;ll upload images for each variant in the next step.
        </p>
      </div>

      <div className="space-y-6">
        {fields.map((field, index) => {
          // Watch the mainColorId to auto-add it to identicalColorIds if not present
          const mainColorId = watch(`variants.${index}.mainColorId`);
          const identicalColorIds = watch(`variants.${index}.identicalColorIds`) || [];

          return (
            <Card key={field.id} className="relative border-primary/20">
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4 text-destructive hover:bg-destructive/10"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <CardHeader>
                <CardTitle className="text-base">
                  Variant {index + 1} {index === 0 && <span className="text-muted-foreground font-normal">(Default)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={control}
                  name={`variants.${index}.name`}
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Variant Name (Optional) <FieldTip tip="A custom name for this color variant (e.g., 'Ivory Gold', 'Royal Purple'). If left blank, the main color name is used as the label." /></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ivory Gold" {...field} />
                      </FormControl>
                      <FormDescription>If left blank, the Main Color name will be used.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`variants.${index}.mainColorId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Color * <FieldTip tip="The dominant/primary color of this item. This is used as the swatch color on the storefront product page." /></FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          // Auto add to identical colors
                          if (!identicalColorIds.includes(val)) {
                            setValue(`variants.${index}.identicalColorIds`, [...identicalColorIds, val]);
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger disabled={isLoadingColors}>
                            <SelectValue placeholder={isLoadingColors ? 'Loading colors...' : 'Select dominant color'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {COLORS.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.hex || '#E5E7EB' }} />
                                {c.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>The primary color of this specific item.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`variants.${index}.identicalColorIds`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identical Colors * <FieldTip tip="All the colors visible in this variant. If a customer searches for 'gold' or 'red', this item will show up. Add the main color + any accent/secondary colors." /></FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          // Very basic multi-select simulation for now
                          if (!field.value.includes(val)) {
                            field.onChange([...field.value, val]);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger disabled={isLoadingColors}>
                            <SelectValue placeholder={isLoadingColors ? 'Loading colors...' : 'Add another color...'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {COLORS.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Show selected colors */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {field.value.map((colorId: string) => {
                          const colorObj = COLORS.find(c => c.id === colorId);
                          if (!colorObj) return null;
                          return (
                            <span key={colorId} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                              <div className="h-2 w-2 rounded-full border border-border" style={{ backgroundColor: colorObj.hex || '#E5E7EB' }} />
                              {colorObj.name}
                              {colorId !== mainColorId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    field.onChange(field.value.filter((id: string) => id !== colorId));
                                  }}
                                  className="ml-1 text-secondary-foreground/50 hover:text-secondary-foreground"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      <FormDescription>Colors that appear in this variant. Helps with search.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          );
        })}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={() => append({ name: '', mainColorId: '', identicalColorIds: [], images: [] })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another Variant
        </Button>
      </div>
    </div>
  );
}
