import { useFormContext, useFieldArray } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

export function DetailsFAQStep() {
  const { control } = useFormContext<ProductFormValues>();

  const {
    fields: detailGroupFields,
    append: appendDetailGroup,
    remove: removeDetailGroup,
  } = useFieldArray({
    control,
    name: 'details',
  });

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({
    control,
    name: 'faqs',
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Details & FAQ</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add comprehensive details and address common questions.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Product Details (Key-Value Builder)</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendDetailGroup({ header: '', items: [{ key: '', value: '' }] })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Detail Section
          </Button>
        </div>

        <div className="space-y-6">
          {detailGroupFields.length === 0 && (
            <div className="text-center p-8 border rounded-lg bg-card text-muted-foreground text-sm">
              No detail sections added yet. Add a section like &quot;Materials&quot; or &quot;Fit Notes&quot;.
            </div>
          )}
          
          {detailGroupFields.map((group, groupIndex) => (
            <Card key={group.id} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 text-destructive hover:bg-destructive/10"
                onClick={() => removeDetailGroup(groupIndex)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <CardHeader>
                <FormField
                  control={control}
                  name={`details.${groupIndex}.header`}
                  render={({ field }) => (
                    <FormItem className="mr-8">
                      <FormControl>
                        <Input placeholder="Section Header (e.g. Materials & Care)" className="font-semibold text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardHeader>
              <CardContent>
                <DetailItemsArray control={control} groupIndex={groupIndex} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">Frequently Asked Questions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add specific FAQs for this product that aren&apos;t covered by your global store FAQs.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {faqFields.map((faq, index) => (
            <Card key={faq.id} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 text-destructive hover:bg-destructive/10 z-10"
                onClick={() => removeFaq(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={control}
                  name={`faqs.${index}.question`}
                  render={({ field }) => (
                    <FormItem className="mr-8">
                      <FormLabel>Question</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Can I wear this if I am taller than 5'8?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`faqs.${index}.answer`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Answer</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g. Yes! The length works perfectly for heights up to 5'10..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          ))}
          
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => appendFaq({ question: '', answer: '' })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailItemsArray({ control, groupIndex }: { control: import('react-hook-form').Control<ProductFormValues>, groupIndex: number }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${groupIndex}.items`,
  });

  return (
    <div className="space-y-3">
      {fields.map((item, itemIndex) => (
        <div key={item.id} className="flex gap-4">
          <FormField
            control={control}
            name={`details.${groupIndex}.items.${itemIndex}.key`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input placeholder="Key (e.g. Fabric)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`details.${groupIndex}.items.${itemIndex}.value`}
            render={({ field }) => (
              <FormItem className="flex-[2]">
                <FormControl>
                  <Input placeholder="Value (e.g. 100% Pure Silk)" {...field} />
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
            onClick={() => remove(itemIndex)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 text-muted-foreground hover:text-foreground"
        onClick={() => append({ key: '', value: '' })}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add Item
      </Button>
    </div>
  );
}
