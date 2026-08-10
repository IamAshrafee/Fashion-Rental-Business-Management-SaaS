'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryApi, type InventorySku } from '@/lib/api/inventory';
import { inventoryOperationsApi } from '@/lib/api/inventory-operations';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

function registrationError(error: unknown): { message: string; errors: RowError[] } {
  const data = (error as { response?: { data?: { message?: string; errors?: RowError[] } } })?.response?.data;
  return {
    message: data?.message ?? 'The physical items could not be registered.',
    errors: Array.isArray(data?.errors) ? data.errors : [],
  };
}

function skuLabel(sku: InventorySku) {
  return `${sku.productName} · ${sku.variantName || 'Default'} · ${sku.sizeLabel}`;
}

export function RegisterItemDialog({
  presetSku,
  trigger,
}: {
  presetSku?: InventorySku;
  trigger?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [skuId, setSkuId] = useState(presetSku?.id ?? '');
  const [skuSearch, setSkuSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [assetPrefix, setAssetPrefix] = useState('');
  const [startingSequence, setStartingSequence] = useState(1);
  const [barcode, setBarcode] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const debouncedSkuSearch = useDebouncedValue(skuSearch, 300);

  const skus = useQuery({
    queryKey: ['inventory-skus', 'registration', debouncedSkuSearch],
    queryFn: () => inventoryApi.listSkus({
      trackingMode: 'SERIALIZED',
      search: debouncedSkuSearch || undefined,
      limit: 50,
    }),
    enabled: open && !presetSku,
  });
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
    enabled: open,
  });
  const components = useQuery({
    queryKey: ['set-component-definitions', skuId],
    queryFn: () => inventoryOperationsApi.listSetComponents(skuId),
    enabled: open && Boolean(skuId),
  });
  const generatedRows = quantity === 1
    ? [{ assetCode: assetCode.trim(), ...(barcode.trim() ? { barcode: barcode.trim() } : {}) }]
    : Array.from({ length: quantity }, (_, index) => ({
        assetCode: `${assetPrefix.trim().replace(/-+$/, '')}-${String(startingSequence + index).padStart(3, '0')}`,
      }));
  const mutation = useMutation({
    mutationFn: () => inventoryApi.registerItemBatch(skuId, {
      locationId,
      rows: generatedRows,
      condition: condition as 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED',
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice ? Math.round(Number(purchasePrice) * 100) : undefined,
      idempotencyKey,
    }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-skus'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-overview'] }),
      ]);
      setOpen(false);
      setAssetCode('');
      setAssetPrefix('');
      setQuantity(1);
      setBarcode('');
      setRowErrors([]);
      toast.success(result.replayed ? 'Registration retry confirmed' : `${result.units.length} physical item${result.units.length === 1 ? '' : 's'} registered`);
    },
    onError: (error) => {
      const failure = registrationError(error);
      setRowErrors(failure.errors);
      toast.error(failure.message);
    },
  });
  const usableLocations = locations.data?.filter((location) => location.isActive && location.canStoreInventory) ?? [];
  const selectedSku = presetSku ?? skus.data?.data.find((sku) => sku.id === skuId);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setIdempotencyKey(crypto.randomUUID());
        setRowErrors([]);
      }
    }}>
      <DialogTrigger asChild>
        {trigger ?? <Button><PackagePlus className="mr-2 size-4" />Register item</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Register physical items</DialogTitle>
          <DialogDescription>
            Create one or an atomic batch of permanent serialized identities. Money is entered in taka.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Product SKU</Label>
            {presetSku ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{skuLabel(presetSku)}</div>
            ) : (
              <div className="space-y-2">
                <Input value={skuSearch} onChange={(event) => setSkuSearch(event.target.value)} placeholder="Find by product, variant, or size" />
                <Select value={skuId} onValueChange={setSkuId}>
                  <SelectTrigger><SelectValue placeholder={skus.isFetching ? 'Searching…' : 'Select a serialized SKU'} /></SelectTrigger>
                  <SelectContent>
                    {skus.data?.data.map((sku) => <SelectItem key={sku.id} value={sku.id}>{skuLabel(sku)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-quantity">Number of pieces</Label>
            <Input id="register-quantity" type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} />
          </div>
          {quantity === 1 ? <div className="grid gap-2">
            <Label htmlFor="register-asset-code">Asset code</Label>
            <Input id="register-asset-code" value={assetCode} onChange={(event) => setAssetCode(event.target.value)} placeholder="DRS-RED-M-001" />
          </div> : <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="register-asset-prefix">Asset-code prefix</Label>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Input id="register-asset-prefix" value={assetPrefix} onChange={(event) => setAssetPrefix(event.target.value)} placeholder="DRS-RED-M" />
              <Input aria-label="Starting sequence" type="number" min={0} value={startingSequence} onChange={(event) => setStartingSequence(Math.max(0, Number(event.target.value) || 0))} />
            </div>
          </div>}
          {quantity === 1 ? <div className="grid gap-2">
            <Label htmlFor="register-barcode">Barcode (optional)</Label>
            <Input id="register-barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
          </div> : null}
          <div className="grid gap-2">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Select storage location" /></SelectTrigger>
              <SelectContent>{usableLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'].map((value) => <SelectItem key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-purchase-date">Purchase date</Label>
            <Input id="register-purchase-date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-purchase-price">Purchase cost (৳)</Label>
            <Input id="register-purchase-price" inputMode="decimal" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2 rounded-md border bg-muted/20 p-3 sm:col-span-2">
            <p className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4" />Identity preview</p>
            {!generatedRows[0]?.assetCode ? <p className="text-xs text-muted-foreground">Enter an asset code or batch prefix.</p> : <div className="flex flex-wrap gap-2">{generatedRows.slice(0, 8).map((row, index) => <span key={`${row.assetCode}-${index}`} className="rounded bg-background px-2 py-1 font-mono text-xs">{row.assetCode}</span>)}{generatedRows.length > 8 ? <span className="px-2 py-1 text-xs text-muted-foreground">+{generatedRows.length - 8} more</span> : null}</div>}
            {components.data?.length ? <p className="text-xs text-muted-foreground">Each piece will initialize {components.data.length} required set component{components.data.length === 1 ? '' : 's'} as present.</p> : null}
          </div>
        </div>
        {rowErrors.length ? <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs"><p className="font-medium text-destructive">Nothing was created. Correct these rows:</p><ul className="mt-1 list-disc space-y-1 pl-4">{rowErrors.map((error, index) => <li key={`${error.row}-${error.field}-${index}`}>{error.row >= 0 ? `Row ${error.row + 1}, ` : ''}{error.field}: {error.message}</li>)}</ul></div> : null}
        {!usableLocations.length && !locations.isLoading ? <p className="text-sm text-destructive">Create an active storage location before registering items.</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!selectedSku || !locationId || !generatedRows.every((row) => row.assetCode.trim()) || mutation.isPending || !usableLocations.length || !idempotencyKey} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Register {quantity} item{quantity === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
