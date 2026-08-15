import { useEffect, useMemo } from 'react';
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
import { majorInputToMinor, minorToMajorInput } from '@/lib/money';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useCategories, useEvents } from '../../../hooks/use-product-apis';
import { FieldTip } from '@/components/shared/field-tip';

const NO_SUBCATEGORY = '__none__';

export function BasicInfoStep() {
  const { control, watch, setValue } = useFormContext<ProductFormValues>();
  const categoryId = watch('categoryId');
  const subcategoryId = watch('subcategoryId');

  const { data: categories, isLoading: isLoadingCats } = useCategories();
  const { data: events, isLoading: isLoadingEvents } = useEvents();

  const currentCategory = categories?.find((c) => c.id === categoryId);
  const subcategories = useMemo(
    () => currentCategory?.subcategories ?? [],
    [currentCategory],
  );

  useEffect(() => {
    if (
      !isLoadingCats &&
      subcategoryId &&
      !subcategories.some((subcategory) => subcategory.id === subcategoryId)
    ) {
      setValue('subcategoryId', undefined, { shouldDirty: true, shouldValidate: true });
    }
  }, [isLoadingCats, setValue, subcategories, subcategoryId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>
                Product Name *{' '}
                <FieldTip helpKey="catalog.productName" />
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g. Royal Banarasi Saree" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>
                Description{' '}
                <FieldTip helpKey="catalog.description" />
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell customers about this product..."
                  className="min-h-[120px]"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Category *{' '}
                <FieldTip helpKey="catalog.category" />
              </FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(value === NO_SUBCATEGORY ? undefined : value)
                }
                value={field.value || NO_SUBCATEGORY}
              >
                <FormControl>
                  <SelectTrigger disabled={isLoadingCats}>
                    <SelectValue placeholder={isLoadingCats ? 'Loading...' : 'Select a category'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="subcategoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Subcategory{' '}
                <FieldTip helpKey="catalog.subcategory" />
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger disabled={!categoryId || subcategories.length === 0}>
                    <SelectValue placeholder="Select a subcategory" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_SUBCATEGORY}>No subcategory</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="events"
          render={() => (
            <FormItem className="col-span-2">
              <div className="mb-4">
                <FormLabel className="text-base">
                  Suitable Events{' '}
                  <FieldTip helpKey="catalog.events" />
                </FormLabel>
                <FormDescription>Select all events this product is suitable for.</FormDescription>
              </div>
              {isLoadingEvents ? (
                <div className="flex px-3 py-2 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" /> Loading
                  events...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {events?.map((event) => (
                    <FormField
                      key={event.id}
                      control={control}
                      name="events"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={event.id}
                            className="flex flex-row items-center space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(event.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, event.id])
                                    : field.onChange(
                                        field.value?.filter((value: string) => value !== event.id),
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer leading-none m-0">
                              {event.name}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-medium">Catalog provenance and reference value</h3>
          <p className="text-sm text-muted-foreground mb-4">
            These values describe the product style. Acquisition date and cost belong to each
            physical rental item and are recorded in Inventory.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <FormField
                control={control}
                name="countryOfOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Country of origin <FieldTip helpKey="catalog.countryOfOrigin" />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Bangladesh" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="countryOfOriginPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>
                        Show origin to customers{' '}
                        <FieldTip tip="When enabled, the storefront may display the country of origin. Keep this off if the value is only for internal cataloging or has not been verified." />
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={control}
                name="referenceRetailValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reference retail value (৳) <FieldTip helpKey="catalog.referenceRetailValue" />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 25000"
                        {...field}
                        value={minorToMajorInput(field.value)}
                        onChange={(event) => field.onChange(majorInputToMinor(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="referenceRetailValuePublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>
                        Show reference value to customers{' '}
                        <FieldTip helpKey="catalog.referenceRetailValuePublic" />
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
