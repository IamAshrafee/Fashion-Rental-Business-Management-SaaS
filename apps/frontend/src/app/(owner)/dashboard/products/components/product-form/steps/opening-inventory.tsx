'use client';

import { useEffect } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Boxes, PackagePlus, Plus, Trash2 } from 'lucide-react';
import type { ProductFormValues } from '../schema';
import { inventoryApi } from '@/lib/api/inventory';
import { sizingApi } from '@/lib/api/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function OpeningInventoryStep() {
  const { control, watch, setValue } = useFormContext<ProductFormValues>();
  const skipped = watch('openingInventorySkipped');
  const variants = watch('variants');
  const productTypeId = watch('productTypeId');
  const sizeSchemaOverrideId = watch('sizeSchemaOverrideId');
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations', 'onboarding'],
    queryFn: () => inventoryApi.listLocations(),
  });
  const { fields } = useFieldArray({ control, name: 'openingInventoryLines' });
  const { data: productTypes = [] } = useQuery({
    queryKey: ['product-types'],
    queryFn: sizingApi.listProductTypes,
  });
  const productType = productTypes.find((type) => type.id === productTypeId);
  const activeSchemaId = sizeSchemaOverrideId || productType?.defaultSizeSchema?.id;
  const { data: activeSchema } = useQuery({
    queryKey: ['size-schema-detail', activeSchemaId],
    queryFn: () => sizingApi.getSchema(activeSchemaId!),
    enabled: Boolean(activeSchemaId),
  });

  useEffect(() => {
    if (fields.length > 0 || locations.length === 0) return;
    const defaultLocation = locations.find((location) => location.isDefault) ?? locations[0];
    const lines = variants.flatMap((variant, variantIndex) =>
      variant.sizeInstanceIds.flatMap((sizeId) => {
        const variantSizeId = variant.skuIdBySizeInstanceId[sizeId];
        if (!variantSizeId) return [];
        return [{
          variantSizeId,
          label: `${variant.name || `Variant ${variantIndex + 1}`} · ${
            activeSchema?.instances?.find((size) => size.id === sizeId)?.displayLabel ?? 'Size'
          }`,
          trackingMode: variant.inventoryBySizeId[sizeId]?.trackingMode ?? 'POOLED' as const,
          locationId: defaultLocation.id,
          pooledQuantity: undefined,
          units: [],
        }];
      }),
    );
    setValue('openingInventoryLines', lines, { shouldDirty: false });
  }, [activeSchema?.instances, fields.length, locations, setValue, variants]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Opening inventory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive pooled stock or register every physical piece at its current location.
        </p>
      </div>

      <FormField
        control={control}
        name="openingInventorySkipped"
        render={({ field }) => (
          <FormItem className="flex items-start gap-3 rounded-lg border p-4">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <div>
              <FormLabel>Add inventory later</FormLabel>
              <p className="text-xs text-muted-foreground">
                The product can be catalogued now, but it will remain unavailable for rental until stock is received.
              </p>
            </div>
          </FormItem>
        )}
      />

      {!skipped && locations.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Create an active inventory location before recording opening stock.
        </div>
      )}

      {!skipped && fields.map((line, lineIndex) => (
        <Card key={line.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {line.trackingMode === 'SERIALIZED' ? <PackagePlus className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
              {line.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name={`openingInventoryLines.${lineIndex}.locationId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current location</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose location" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {locations.filter((location) => location.canStoreInventory).map((location) => (
                        <SelectItem key={location.id} value={location.id}>{location.name} ({location.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {line.trackingMode === 'POOLED' ? (
              <FormField
                control={control}
                name={`openingInventoryLines.${lineIndex}.pooledQuantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pieces on hand</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value ? event.target.valueAsNumber : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <SerializedUnits lineIndex={lineIndex} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SerializedUnits({ lineIndex }: { lineIndex: number }) {
  const { control } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `openingInventoryLines.${lineIndex}.units`,
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Physical pieces</p>
          <p className="text-xs text-muted-foreground">Each piece needs its own permanent asset code.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({
            assetCode: '',
            barcode: '',
            condition: 'GOOD',
            purchaseDate: undefined,
            purchasePrice: undefined,
            notes: undefined,
          })}
        >
          <Plus className="h-4 w-4" /> Add piece
        </Button>
      </div>
      {fields.map((unit, unitIndex) => (
        <div key={unit.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_10rem_auto]">
          <FormField
            control={control}
            name={`openingInventoryLines.${lineIndex}.units.${unitIndex}.assetCode`}
            render={({ field }) => (
              <FormItem><FormLabel>Asset code</FormLabel><FormControl><Input placeholder="DRS-RED-M-001" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={control}
            name={`openingInventoryLines.${lineIndex}.units.${unitIndex}.barcode`}
            render={({ field }) => (
              <FormItem><FormLabel>Barcode (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField
            control={control}
            name={`openingInventoryLines.${lineIndex}.units.${unitIndex}.condition`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condition</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR'].map((condition) => (
                      <SelectItem key={condition} value={condition}>{condition.toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <Button type="button" variant="ghost" size="icon" className="self-end text-destructive" onClick={() => remove(unitIndex)}>
            <Trash2 className="h-4 w-4" /><span className="sr-only">Remove piece</span>
          </Button>
        </div>
      ))}
      {fields.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No pieces registered yet.</p>}
    </div>
  );
}
