'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
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
import { ProductFormValues } from '../schema';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, X, Ruler, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldTip } from '@/components/shared/field-tip';

// ─── Standard Size Presets ────────────────────────────────────────────────────
const STANDARD_SIZES = [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL',
  // Numerical
  '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20',
  // US Shoe (optional)
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45',
];

const UNIT_OPTIONS = [
  { value: 'inch', label: 'Inches' },
  { value: 'cm', label: 'cm' },
  { value: 'ft', label: 'Feet' },
];

// ─── Measurement Row Component ────────────────────────────────────────────────

function MeasurementFields({
  prefix,
  index,
  onRemove,
}: {
  prefix: string;
  index: number;
  onRemove: () => void;
}) {
  const form = useFormContext<ProductFormValues>();

  return (
    <div className="flex items-center gap-2 group">
      <div className="flex-1">
        <FormField
          control={form.control}
          name={`${prefix}.${index}.label` as any}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder="e.g. Chest, Waist, Hip"
                  {...field}
                  className="h-9 text-sm"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      <div className="w-24">
        <FormField
          control={form.control}
          name={`${prefix}.${index}.value` as any}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  step="0.5"
                  className="h-9 text-sm"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      <div className="w-24">
        <FormField
          control={form.control}
          name={`${prefix}.${index}.unit` as any}
          render={({ field }) => (
            <FormItem>
              <Select value={field.value || 'inch'} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UNIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main Size Step ───────────────────────────────────────────────────────────

export function SizeStep() {
  const form = useFormContext<ProductFormValues>();
  const sizeMode = form.watch('sizeMode');
  const availableSizes = form.watch('availableSizes') ?? [];

  const measurementsArray = useFieldArray({
    control: form.control,
    name: 'measurements' as any,
  });

  const partsArray = useFieldArray({
    control: form.control,
    name: 'parts' as any,
  });

  const toggleSize = (size: string) => {
    const current = form.getValues('availableSizes') ?? [];
    if (current.includes(size)) {
      form.setValue(
        'availableSizes',
        current.filter((s) => s !== size),
        { shouldDirty: true }
      );
      // If removed size was mainDisplaySize, clear it
      if (form.getValues('mainDisplaySize') === size) {
        form.setValue('mainDisplaySize', undefined, { shouldDirty: true });
      }
    } else {
      form.setValue('availableSizes', [...current, size], { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Size & Measurements</h2>
        <p className="text-sm text-muted-foreground">
          Tell customers what size your product is. Accurate sizing reduces returns.
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
          Accurate measurements help customers find the right fit and significantly reduce return rates.
        </AlertDescription>
      </Alert>

      {/* Size Mode Selector */}
      <FormField
        control={form.control}
        name="sizeMode"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Sizing Method <FieldTip tip="Choose how to describe your product's size. Standard sizes work for most clothing. Custom measurements are best for tailored or fitted items." /></FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val);
                  // Reset mode-specific fields when switching
                  if (val !== 'standard') {
                    form.setValue('availableSizes', [], { shouldDirty: true });
                    form.setValue('mainDisplaySize', undefined, { shouldDirty: true });
                  }
                  if (val !== 'free') {
                    form.setValue('freeSizeType', undefined, { shouldDirty: true });
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {[
                  {
                    value: 'standard',
                    label: 'Standard Sizes',
                    desc: 'Select from S, M, L, XL etc.',
                  },
                  {
                    value: 'measurement',
                    label: 'Custom Measurements',
                    desc: 'Enter chest, waist, hip etc.',
                  },
                  {
                    value: 'multi_part',
                    label: 'Multi-Part',
                    desc: 'e.g. Top + Bottom with separate measurements',
                  },
                  {
                    value: 'free',
                    label: 'Free Size / Adjustable',
                    desc: 'One size, adjustable, or no size needed',
                  },
                ].map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`size-${option.value}`}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50',
                      field.value === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    <RadioGroupItem value={option.value} id={`size-${option.value}`} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium block">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.desc}</span>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      {/* ── Standard Sizes ─────────────────────────────────────────── */}
      {sizeMode === 'standard' && (
        <div className="space-y-5">
          <div>
            <Label className="mb-3 block text-sm font-medium">Available Sizes</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Click to select which sizes are available for this product.
            </p>
            <div className="flex flex-wrap gap-2">
              {STANDARD_SIZES.map((size) => {
                const isSelected = availableSizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all duration-150',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            {/* Custom size input */}
            <div className="flex items-center gap-2 mt-3">
              <Input
                id="custom-size-input"
                placeholder="Add custom size..."
                className="h-9 max-w-[200px] text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                    if (val && !availableSizes.includes(val)) {
                      form.setValue('availableSizes', [...availableSizes, val], { shouldDirty: true });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">Press Enter to add</span>
            </div>
            {availableSizes.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Select at least one available size
              </p>
            )}
          </div>

          {/* Main Display Size */}
          {availableSizes.length > 0 && (
            <FormField
              control={form.control}
              name="mainDisplaySize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Display Size <FieldTip tip="The default size highlighted on the product page. Usually the most popular or commonly requested size." /></FormLabel>
                  <FormDescription>
                    This size will be shown by default on the product page.
                  </FormDescription>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select primary size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableSizes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Optional measurements for standard sizes too */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="block text-sm font-medium">Measurements (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  Add exact measurements for customers who want precise sizing.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => measurementsArray.append({ label: '', value: 0, unit: 'inch' })}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {measurementsArray.fields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div className="flex-1">Label</div>
                  <div className="w-24">Value</div>
                  <div className="w-24">Unit</div>
                  <div className="w-8" />
                </div>
                {measurementsArray.fields.map((field, index) => (
                  <MeasurementFields
                    key={field.id}
                    prefix="measurements"
                    index={index}
                    onRemove={() => measurementsArray.remove(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Measurement Mode ───────────────────────────────────────── */}
      {sizeMode === 'measurement' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="block text-sm font-medium">Body Measurements</Label>
              <p className="text-sm text-muted-foreground">
                Enter the measurements of the garment (not the wearer).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => measurementsArray.append({ label: '', value: 0, unit: 'inch' })}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Measurement
            </Button>
          </div>
          {measurementsArray.fields.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
              <Ruler className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No measurements added yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add measurements like Chest, Waist, Hip, Length etc.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() =>
                  measurementsArray.append({ label: '', value: 0, unit: 'inch' })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add First Measurement
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="flex-1">Label</div>
                <div className="w-24">Value</div>
                <div className="w-24">Unit</div>
                <div className="w-8" />
              </div>
              {measurementsArray.fields.map((field, index) => (
                <MeasurementFields
                  key={field.id}
                  prefix="measurements"
                  index={index}
                  onRemove={() => measurementsArray.remove(index)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Multi-Part Mode ────────────────────────────────────────── */}
      {sizeMode === 'multi_part' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="block text-sm font-medium">Parts</Label>
              <p className="text-sm text-muted-foreground">
                Define each part separately (e.g. Top, Bottom, Dupatta) with its own measurements.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => partsArray.append({ partName: '', measurements: [] })}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Part
            </Button>
          </div>

          {partsArray.fields.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
              <Ruler className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No parts added yet. Add parts like &quot;Top&quot;, &quot;Bottom&quot;, &quot;Dupatta&quot;.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => partsArray.append({ partName: '', measurements: [] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add First Part
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {partsArray.fields.map((partField, partIndex) => (
                <PartCard key={partField.id} partIndex={partIndex} onRemove={() => partsArray.remove(partIndex)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Free Size Mode ─────────────────────────────────────────── */}
      {sizeMode === 'free' && (
        <FormField
          control={form.control}
          name="freeSizeType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Free Size Type</FormLabel>
              <FormDescription>
                Specify what &quot;free size&quot; means for this product.
              </FormDescription>
              <FormControl>
                <RadioGroup
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {[
                    {
                      value: 'free_size',
                      label: 'Free Size',
                      desc: 'Standard free/one-size-fits-all',
                    },
                    {
                      value: 'adjustable',
                      label: 'Adjustable',
                      desc: 'Has ties, elastic, or adjustable features',
                    },
                    {
                      value: 'no_size',
                      label: 'No Size Needed',
                      desc: 'Accessories, bags, jewelry etc.',
                    },
                  ].map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`free-size-${option.value}`}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50',
                        field.value === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      )}
                    >
                      <RadioGroupItem value={option.value} id={`free-size-${option.value}`} className="mt-0.5" />
                      <div>
                        <span className="text-sm font-medium block">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.desc}</span>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* ── Size Chart (all modes) ─────────────────────────────────── */}
      <div className="pt-4 border-t">
        <FormField
          control={form.control}
          name="sizeChartUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Size Chart URL (Optional) <FieldTip tip="Link to a size chart image or page. Helps customers compare measurements and pick the right size." /></FormLabel>
              <FormDescription>
                Link to an external size chart image or page for reference.
              </FormDescription>
              <FormControl>
                <Input
                  placeholder="https://example.com/size-chart.png"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

// ─── Part Card (Multi-Part Mode) ──────────────────────────────────────────────

function PartCard({ partIndex, onRemove }: { partIndex: number; onRemove: () => void }) {
  const form = useFormContext<ProductFormValues>();

  const measurementsArray = useFieldArray({
    control: form.control,
    name: `parts.${partIndex}.measurements` as any,
  });

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <FormField
            control={form.control}
            name={`parts.${partIndex}.partName` as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Part Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Top, Bottom, Dupatta"
                    {...field}
                    className="h-9 text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-5"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Measurements
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => measurementsArray.append({ label: '', value: 0, unit: 'inch' })}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {measurementsArray.fields.length > 0 && (
          <div className="space-y-1.5">
            {measurementsArray.fields.map((field, mIndex) => (
              <MeasurementFields
                key={field.id}
                prefix={`parts.${partIndex}.measurements`}
                index={mIndex}
                onRemove={() => measurementsArray.remove(mIndex)}
              />
            ))}
          </div>
        )}
        {measurementsArray.fields.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No measurements for this part yet.
          </p>
        )}
      </div>
    </div>
  );
}
