'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Loader2, PackagePlus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { FieldTip } from '@/components/shared/field-tip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { inventoryApi, type BatchInventoryItemInput, type InventorySku } from '@/lib/api/inventory';
import { inventoryOperationsApi, type StockConditionGrade } from '@/lib/api/inventory-operations';
import {
  blankRegistrationRow,
  buildRegistrationPayload,
  generateAssetCodes,
  type RegistrationDefaults,
  type RegistrationRow,
} from './schema';
import {
  registrationFailure,
  useRegistration,
  type RegistrationRowError,
} from './use-registration';

const CONDITIONS: StockConditionGrade[] = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const PRESENCE_OPTIONS = ['PRESENT', 'MISSING', 'DAMAGED', 'NOT_APPLICABLE'] as const;

function label(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function skuLabel(sku: InventorySku) {
  return `${sku.productName} · ${sku.variantName || 'Default variant'} · ${sku.sizeLabel}`;
}

const DEFAULTS: RegistrationDefaults = {
  condition: 'GOOD',
  acquisitionDate: '',
  acquisitionCost: '',
  acquisitionSource: '',
  acquisitionReference: '',
  notes: '',
};

export function RegistrationForm({
  initialProductId,
  initialVariantSizeId,
  returnTo,
}: {
  initialProductId?: string;
  initialVariantSizeId?: string;
  returnTo: string;
}) {
  const [skuId, setSkuId] = useState(initialVariantSizeId ?? '');
  const [skuSearch, setSkuSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [prefix, setPrefix] = useState('');
  const [sequence, setSequence] = useState(1);
  const [defaults, setDefaults] = useState<RegistrationDefaults>(DEFAULTS);
  const [rows, setRows] = useState<RegistrationRow[]>([blankRegistrationRow()]);
  const [componentStates, setComponentStates] = useState<
    NonNullable<BatchInventoryItemInput['componentStates']>
  >([]);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [rowErrors, setRowErrors] = useState<RegistrationRowError[]>([]);
  const [registered, setRegistered] = useState<Array<{ id: string; assetCode: string }> | null>(
    null,
  );
  const debouncedSearch = useDebouncedValue(skuSearch, 300);
  const registration = useRegistration();

  useEffect(() => setIdempotencyKey(crypto.randomUUID()), []);
  const skus = useQuery({
    queryKey: ['inventory-skus', 'registration', initialProductId, debouncedSearch],
    queryFn: () =>
      inventoryApi.listSkus({
        productId: initialProductId,
        search: debouncedSearch || undefined,
        page: 1,
        limit: 100,
        sort: 'PRODUCT',
        order: 'asc',
      }),
  });
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });
  const components = useQuery({
    queryKey: ['set-component-definitions', skuId],
    queryFn: () => inventoryOperationsApi.listSetComponents(skuId),
    enabled: Boolean(skuId),
  });
  useEffect(() => {
    setComponentStates(
      (components.data ?? []).map((definition) => ({
        definitionId: definition.id,
        presence: 'PRESENT',
        presentQuantity: definition.requiredQuantity,
        condition: defaults.condition,
      })),
    );
  }, [components.data, defaults.condition]);

  const usableLocations =
    locations.data?.filter((location) => location.isActive && location.canStoreInventory) ?? [];
  const selectedSku = skus.data?.data.find((sku) => sku.id === skuId);
  const duplicateCodes = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    rows.forEach((row) => {
      const code = row.assetCode.trim().toUpperCase();
      if (code && seen.has(code)) duplicates.add(code);
      seen.add(code);
    });
    return duplicates;
  }, [rows]);

  const resizeRows = (nextQuantity: number) => {
    const next = Math.min(100, Math.max(1, nextQuantity || 1));
    setQuantity(next);
    setRows((current) =>
      Array.from({ length: next }, (_, index) => current[index] ?? blankRegistrationRow()),
    );
    setRowErrors([]);
  };
  const updateRow = (index: number, patch: Partial<RegistrationRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
    setRowErrors((current) => current.filter((error) => error.row !== index));
  };
  const generateRows = () => {
    const codes = generateAssetCodes(prefix, sequence, quantity);
    setRows((current) => current.map((row, index) => ({ ...row, assetCode: codes[index] ?? '' })));
    setRowErrors([]);
  };
  const resetForSameSku = () => {
    setRegistered(null);
    setRows(Array.from({ length: quantity }, () => blankRegistrationRow()));
    setRowErrors([]);
    setIdempotencyKey(crypto.randomUUID());
  };
  const submit = async () => {
    if (!skuId || !locationId || rows.some((row) => !row.assetCode.trim()) || duplicateCodes.size)
      return;
    try {
      const result = await registration.mutateAsync({
        variantSizeId: skuId,
        payload: buildRegistrationPayload({
          locationId,
          defaults,
          rows,
          idempotencyKey,
          componentStates,
        }),
      });
      setRegistered(result.units);
      setRowErrors([]);
      toast.success(
        result.replayed
          ? 'Registration retry confirmed'
          : `${result.units.length} physical item${result.units.length === 1 ? '' : 's'} registered`,
      );
    } catch (error) {
      const failure = registrationFailure(error);
      setRowErrors(failure.errors);
      toast.error(failure.message);
    }
  };

  if (registered) {
    return (
      <Card>
        <CardHeader>
          <CheckCircle2 className="size-10 text-emerald-600" />
          <CardTitle>
            {registered.length} physical item{registered.length === 1 ? '' : 's'} registered
          </CardTitle>
          <CardDescription>
            Each item now has a permanent identity and its own inventory history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {registered.map((unit) => (
              <span key={unit.id} className="rounded-md border px-2 py-1 font-mono text-xs">
                {unit.assetCode}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={resetForSameSku}>
              <RotateCcw className="mr-2 size-4" />
              Register another batch for this SKU
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForSameSku();
                setSkuId('');
              }}
            >
              Choose another SKU
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/inventory/items?variantSizeId=${encodeURIComponent(skuId)}`}>
                View registered items
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={returnTo}>Return</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Catalog SKU and location</CardTitle>
          <CardDescription>
            Select what these pieces are and where they are physically stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Product SKU <FieldTip helpKey="catalog.sku" />
            </Label>
            <Input
              value={skuSearch}
              onChange={(event) => setSkuSearch(event.target.value)}
              placeholder="Search product, variant, or size"
            />
            <Select
              value={skuId}
              onValueChange={(value) => {
                setSkuId(value);
                setRowErrors([]);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={skus.isFetching ? 'Loading SKUs…' : 'Select a rentable SKU'}
                />
              </SelectTrigger>
              <SelectContent>
                {skus.data?.data.map((sku) => (
                  <SelectItem key={sku.id} value={sku.id}>
                    {skuLabel(sku)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {initialProductId && !skus.isLoading && !skus.data?.data.length ? (
              <p className="text-sm text-destructive">
                This product has no active rentable SKU. Add a variant and size in Edit Product
                first.
              </p>
            ) : null}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Current storage location <FieldTip helpKey="inventory.location" />
            </Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an inventory-storing location" />
              </SelectTrigger>
              <SelectContent>
                {usableLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!locations.isLoading && !usableLocations.length ? (
              <p className="text-sm text-destructive">
                Create an active inventory-storing location before registration.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Shared acquisition defaults</CardTitle>
          <CardDescription>
            These values apply to every row unless you provide a row-specific override.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Initial condition <FieldTip helpKey="inventory.condition" />
            </Label>
            <Select
              value={defaults.condition}
              onValueChange={(condition) =>
                setDefaults((current) => ({
                  ...current,
                  condition: condition as StockConditionGrade,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {label(condition)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acquisition-date">
              Acquisition date <FieldTip helpKey="inventory.acquisitionDate" />
            </Label>
            <Input
              id="acquisition-date"
              type="date"
              value={defaults.acquisitionDate}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, acquisitionDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acquisition-cost">
              Unit acquisition cost (৳) <FieldTip helpKey="inventory.acquisitionCost" />
            </Label>
            <Input
              id="acquisition-cost"
              inputMode="decimal"
              value={defaults.acquisitionCost}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, acquisitionCost: event.target.value }))
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acquisition-source">
              Acquisition source <FieldTip helpKey="inventory.acquisitionSource" />
            </Label>
            <Input
              id="acquisition-source"
              value={defaults.acquisitionSource}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, acquisitionSource: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acquisition-reference">
              Acquisition reference <FieldTip helpKey="inventory.acquisitionReference" />
            </Label>
            <Input
              id="acquisition-reference"
              value={defaults.acquisitionReference}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, acquisitionReference: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registration-notes">Internal notes</Label>
            <Textarea
              id="registration-notes"
              value={defaults.notes}
              onChange={(event) =>
                setDefaults((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Optional acquisition or registration context"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Permanent identities</CardTitle>
          <CardDescription>
            Every row is one real garment, accessory, or rentable set—not an editable quantity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr_8rem_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="item-count">
                Number of items{' '}
                <FieldTip tip="Enter the number of distinct physical pieces being registered, up to 100. A batch of 3 creates three permanent asset records." />
              </Label>
              <Input
                id="item-count"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(event) => resizeRows(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-prefix">
                Asset-code prefix{' '}
                <FieldTip tip="The shared identity prefix. Example: DRS-RED-M with starting sequence 1 generates DRS-RED-M-001, -002, and -003." />
              </Label>
              <Input
                id="asset-prefix"
                value={prefix}
                onChange={(event) => setPrefix(event.target.value)}
                placeholder="DRS-RED-M"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-sequence">Starts at</Label>
              <Input
                id="asset-sequence"
                type="number"
                min={0}
                value={sequence}
                onChange={(event) => setSequence(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            <Button variant="outline" onClick={generateRows}>
              Generate codes
            </Button>
          </div>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const errors = rowErrors.filter((error) => error.row === index);
              const duplicate = duplicateCodes.has(row.assetCode.trim().toUpperCase());
              return (
                <details
                  key={index}
                  className="rounded-lg border p-3"
                  open={quantity <= 5 || errors.length > 0 || duplicate}
                >
                  <summary className="cursor-pointer list-none font-medium">
                    <span className="flex items-center justify-between gap-3">
                      <span>
                        Item {index + 1} ·{' '}
                        <span className="font-mono">{row.assetCode || 'identity required'}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Open for barcode or overrides
                      </span>
                    </span>
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Asset code</Label>
                      <Input
                        value={row.assetCode}
                        onChange={(event) => updateRow(index, { assetCode: event.target.value })}
                        placeholder="Permanent internal identity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Barcode (optional) <FieldTip helpKey="inventory.barcode" />
                      </Label>
                      <Input
                        value={row.barcode}
                        onChange={(event) => updateRow(index, { barcode: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Condition override</Label>
                      <Select
                        value={row.condition || 'default'}
                        onValueChange={(value) =>
                          updateRow(index, {
                            condition: value === 'default' ? '' : (value as StockConditionGrade),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            Use shared: {label(defaults.condition)}
                          </SelectItem>
                          {CONDITIONS.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {label(condition)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Acquisition cost override (৳)</Label>
                      <Input
                        inputMode="decimal"
                        value={row.acquisitionCost}
                        onChange={(event) =>
                          updateRow(index, { acquisitionCost: event.target.value })
                        }
                        placeholder={defaults.acquisitionCost || 'Use shared value'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Acquisition date override</Label>
                      <Input
                        type="date"
                        value={row.acquisitionDate}
                        onChange={(event) =>
                          updateRow(index, { acquisitionDate: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Source/reference override</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          aria-label={`Item ${index + 1} acquisition source`}
                          value={row.acquisitionSource}
                          onChange={(event) =>
                            updateRow(index, { acquisitionSource: event.target.value })
                          }
                          placeholder="Source"
                        />
                        <Input
                          aria-label={`Item ${index + 1} acquisition reference`}
                          value={row.acquisitionReference}
                          onChange={(event) =>
                            updateRow(index, { acquisitionReference: event.target.value })
                          }
                          placeholder="Reference"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Row notes override</Label>
                      <Textarea
                        value={row.notes}
                        onChange={(event) => updateRow(index, { notes: event.target.value })}
                        placeholder="Leave blank to use shared notes"
                      />
                    </div>
                    {duplicate ? (
                      <p className="text-sm text-destructive sm:col-span-2">
                        This asset code is duplicated in the batch.
                      </p>
                    ) : null}
                    {errors.length ? (
                      <ul className="list-disc pl-5 text-sm text-destructive sm:col-span-2">
                        {errors.map((error, errorIndex) => (
                          <li key={`${error.field}-${errorIndex}`}>
                            {error.field}: {error.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {components.data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Set components</CardTitle>
            <CardDescription>
              Initialize the required component state applied to every physical item in this batch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {components.data.map((definition) => {
              const state = componentStates.find((item) => item.definitionId === definition.id);
              return (
                <div
                  key={definition.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_12rem_8rem] sm:items-center"
                >
                  <div>
                    <p className="font-medium">{definition.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Required quantity: {definition.requiredQuantity}
                      {definition.inspectionGuidance ? ` · ${definition.inspectionGuidance}` : ''}
                    </p>
                  </div>
                  <Select
                    value={state?.presence ?? 'PRESENT'}
                    onValueChange={(presence) =>
                      setComponentStates((current) =>
                        current.map((item) =>
                          item.definitionId === definition.id
                            ? { ...item, presence: presence as (typeof PRESENCE_OPTIONS)[number] }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESENCE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {label(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={`${definition.name} present quantity`}
                    type="number"
                    min={0}
                    max={100}
                    value={state?.presentQuantity ?? definition.requiredQuantity}
                    onChange={(event) =>
                      setComponentStates((current) =>
                        current.map((item) =>
                          item.definitionId === definition.id
                            ? {
                                ...item,
                                presentQuantity: Math.max(0, Number(event.target.value) || 0),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {rowErrors.some((error) => error.row < 0) ? (
        <Alert variant="destructive">
          <ClipboardList className="size-4" />
          <AlertTitle>Batch configuration needs attention</AlertTitle>
          <AlertDescription>
            {rowErrors
              .filter((error) => error.row < 0)
              .map((error) => error.message)
              .join(' ')}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              Ready to register {quantity} physical item{quantity === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedSku ? skuLabel(selectedSku) : 'Select a SKU'} ·{' '}
              {usableLocations.find((location) => location.id === locationId)?.name ||
                'Select a location'}
            </p>
          </div>
          <Button
            size="lg"
            disabled={
              !selectedSku ||
              !locationId ||
              !idempotencyKey ||
              rows.some((row) => !row.assetCode.trim()) ||
              duplicateCodes.size > 0 ||
              registration.isPending ||
              !usableLocations.length
            }
            onClick={() => void submit()}
          >
            {registration.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-2 size-4" />
            )}
            Register batch atomically
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
