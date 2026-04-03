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

export function BasicInfoStep() {
  const { control, watch } = useFormContext<ProductFormValues>();
  const categoryId = watch('categoryId');
  
  const { data: categories, isLoading: isLoadingCats } = useCategories();
  const { data: events, isLoading: isLoadingEvents } = useEvents();

  const currentCategory = categories?.find((c) => c.id === categoryId);
  const subcategories = currentCategory?.subcategories || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Product Name * <FieldTip tip="The name customers will see on your storefront. Use a descriptive name like 'Royal Banarasi Saree - Ivory Gold'." /></FormLabel>
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
              <FormLabel>Description <FieldTip tip="A detailed description helps customers understand the product. Mention fabric, occasion, styling tips, and any special features." /></FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell customers about this product..."
                  className="min-h-[120px]"
                  {...field}
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
              <FormLabel>Category * <FieldTip tip="The main product category (e.g., Saree, Lehenga, Sherwani). Determines how the product is organized on your storefront." /></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger disabled={isLoadingCats}>
                    <SelectValue placeholder={isLoadingCats ? "Loading..." : "Select a category"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
              <FormLabel>Subcategory <FieldTip tip="A more specific classification within the category. Helps customers find exactly what they're looking for." /></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger disabled={!categoryId || subcategories.length === 0}>
                    <SelectValue placeholder="Select a subcategory" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
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
                <FormLabel className="text-base">Suitable Events <FieldTip tip="Select events where this product would be appropriate (e.g., Wedding, Engagement, Eid). Customers can filter by event." /></FormLabel>
                <FormDescription>
                  Select all events this product is suitable for.
                </FormDescription>
              </div>
              {isLoadingEvents ? (
                <div className="flex px-3 py-2 border rounded-md"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" /> Loading events...</div>
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
                                        field.value?.filter(
                                          (value: string) => value !== event.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer leading-none m-0">
                              {event.name}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Setup Status <FieldTip tip="Draft products are hidden from your storefront. Set to Published when the product is ready to be rented." /></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">Draft (Hidden)</SelectItem>
                  <SelectItem value="published">Published (Visible)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Published products appear on your storefront.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={control}
          name="targetRentals"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Rentals <FieldTip tip="Your goal for how many times this product should be rented. Used for ROI tracking on the analytics dashboard." /></FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="e.g. 10" 
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                />
              </FormControl>
              <FormDescription>
                Goal for ROI calculation (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-medium">Internal Purchase Info</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Used for your own accounting. Optionally show to customers to highlight value.
          </p>
          
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date <FieldTip tip="When you originally bought this item. Used for depreciation tracking and accounting reports." /></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price (৳) <FieldTip tip="What you paid for this item. Helps calculate ROI and profit margin per rental. Not shown to customers by default." /></FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 15000" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="showPurchasePrice"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Show price to guests <FieldTip tip="If enabled, customers can see the original purchase price on the product page — useful for showing they're getting a deal." /></FormLabel>
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
            </div>

            <div className="space-y-4">
              <FormField
                control={control}
                name="itemCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Country <FieldTip tip="The country of origin or manufacture. Adds authenticity for imported or handcrafted items (e.g., India, Turkey, Italy)." /></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. India, Turkey" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="showCountry"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Show country to guests <FieldTip tip="Display the item's country of origin on the product page. Adds a premium feel for imported items." /></FormLabel>
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
            </div>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
