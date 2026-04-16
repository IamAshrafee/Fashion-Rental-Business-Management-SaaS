'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
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
import { Plus, Trash2, ChevronDown, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useColors } from '../../../hooks/use-product-apis';
import { sizingApi } from '@/lib/api/products';
import { FieldTip } from '@/components/shared/field-tip';
import { ImageUploader } from '@/components/shared/image-uploader';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function VariantsMediaStep() {
  const { control, watch, setValue } = useFormContext<ProductFormValues>();
  const { data: colors, isLoading: isLoadingColors } = useColors();
  const COLORS = colors || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  });

  // Resolve sizing
  const productTypeId = watch('productTypeId');
  const sizeSchemaOverrideId = watch('sizeSchemaOverrideId');
  const { data: productTypes = [] } = useQuery({
    queryKey: ['product-types'],
    queryFn: sizingApi.listProductTypes,
  });
  const selectedType = productTypes.find((t: any) => t.id === productTypeId);
  const activeSchemaId = sizeSchemaOverrideId || selectedType?.defaultSizeSchema?.id;
  const { data: activeSchema } = useQuery({
    queryKey: ['size-schema-detail', activeSchemaId],
    queryFn: () => sizingApi.getSchema(activeSchemaId!),
    enabled: !!activeSchemaId,
  });
  const sizeInstances = activeSchema?.instances || [];

  // Track which variant cards have their images section expanded
  const [expandedImages, setExpandedImages] = useState<Record<number, boolean>>(() => {
    // Default: expand the first variant's images
    return { 0: true };
  });

  const toggleImages = (index: number) => {
    setExpandedImages(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Variants & Media</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add color variants and upload images for each. Every variant needs at least one image.
        </p>
      </div>

      <div className="space-y-6">
        {fields.map((field, index) => {
          const mainColorId = watch(`variants.${index}.mainColorId`);
          const identicalColorIds = watch(`variants.${index}.identicalColorIds`) || [];
          const images = watch(`variants.${index}.images`) || [];
          const imageCount = images.length;
          const isImagesOpen = expandedImages[index] ?? false;
          const variantName = watch(`variants.${index}.name`);
          const mainColor = COLORS.find((c: any) => c.id === mainColorId);

          return (
            <Card key={field.id} className="relative border-primary/20">
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4 text-destructive hover:bg-destructive/10 z-10 h-10 w-10"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {mainColor?.hexCode && (
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: mainColor.hexCode }} />
                  )}
                  {variantName || mainColor?.name || `Variant ${index + 1}`}
                  {index === 0 && <span className="text-muted-foreground font-normal text-sm">(Default)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Color fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={control}
                    name={`variants.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Variant Name (Optional) <FieldTip tip="Custom name like 'Ivory Gold'. If blank, the color name is used." /></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Ivory Gold" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name={`variants.${index}.mainColorId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main Color * <FieldTip tip="The dominant color shown as the swatch." /></FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (!identicalColorIds.includes(val)) {
                              setValue(`variants.${index}.identicalColorIds`, [...identicalColorIds, val]);
                            }
                          }}
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger disabled={isLoadingColors} className="h-11">
                              <SelectValue placeholder={isLoadingColors ? 'Loading colors...' : 'Select dominant color'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {COLORS.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.hexCode || '#E5E7EB' }} />
                                  {c.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {sizeInstances.length > 0 && (
                    <FormField
                      control={control}
                      name={`variants.${index}.sizeInstanceIds`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Sizes <FieldTip tip="Select all sizes available for this color variant." /></FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {sizeInstances.map((inst: any) => {
                              const isSelected = field.value?.includes(inst.id);
                              return (
                                <button
                                  type="button"
                                  key={inst.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      field.onChange(field.value.filter((id: string) => id !== inst.id));
                                    } else {
                                      field.onChange([...(field.value || []), inst.id]);
                                    }
                                  }}
                                  className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                                    isSelected 
                                      ? 'bg-primary text-primary-foreground border-primary' 
                                      : 'bg-background text-foreground hover:bg-muted'
                                  }`}
                                >
                                  {inst.displayLabel}
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={control}
                    name={`variants.${index}.identicalColorIds`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identical Colors * <FieldTip tip="All visible colors for search matching." /></FormLabel>
                        <Select
                          key={`identical-${index}-${field.value.length}`}
                          onValueChange={(val) => {
                            if (!field.value.includes(val)) {
                              field.onChange([...field.value, val]);
                            }
                          }}
                          value={undefined}
                        >
                          <FormControl>
                            <SelectTrigger disabled={isLoadingColors} className="h-11">
                              <SelectValue placeholder={isLoadingColors ? 'Loading...' : 'Add another color...'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {COLORS.filter((c: any) => !field.value.includes(c.id)).map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.hexCode || '#E5E7EB' }} />
                                  {c.name}
                                </div>
                              </SelectItem>
                            ))}
                            {COLORS.filter((c: any) => !field.value.includes(c.id)).length === 0 && (
                              <div className="p-2 text-sm text-muted-foreground text-center">All colors added</div>
                            )}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value.map((colorId: string) => {
                            const colorObj = COLORS.find(c => c.id === colorId);
                            if (!colorObj) return null;
                            return (
                              <span key={colorId} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground min-h-[28px]">
                                <div className="h-2 w-2 rounded-full border border-border" style={{ backgroundColor: colorObj.hexCode || '#E5E7EB' }} />
                                {colorObj.name}
                                {colorId !== mainColorId && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      field.onChange(field.value.filter((id: string) => id !== colorId));
                                    }}
                                    className="ml-1 text-secondary-foreground/50 hover:text-secondary-foreground p-0.5"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Images Section (inline, collapsible) ────────── */}
                <div className="border rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggleImages(index)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors rounded-lg min-h-[48px]"
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Images</span>
                      <Badge
                        variant={imageCount > 0 ? 'default' : 'destructive'}
                        className={cn(
                          'h-5 px-1.5 text-[10px] font-medium',
                          imageCount > 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        )}
                      >
                        {imageCount}
                      </Badge>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isImagesOpen && 'rotate-180')} />
                  </button>
                  {isImagesOpen && (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-muted-foreground mb-3">
                        Drag to reorder. First image marked ★ is the featured thumbnail.
                      </p>
                      <FormField
                        control={control}
                        name={`variants.${index}.images`}
                        render={({ field }) => (
                          <FormItem>
                            <ImageUploader
                              images={field.value}
                              onChange={field.onChange}
                              maxImages={10}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed min-h-[48px]"
          onClick={() => {
            const newIndex = fields.length;
            append({ name: '', mainColorId: '', sizeInstanceIds: [], identicalColorIds: [], images: [] });
            setExpandedImages(prev => ({ ...prev, [newIndex]: true }));
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another Variant
        </Button>
      </div>
    </div>
  );
}


