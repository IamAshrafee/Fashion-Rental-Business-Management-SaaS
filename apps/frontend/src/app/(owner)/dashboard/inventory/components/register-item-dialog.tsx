'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryApi, type InventorySku } from '@/lib/api/inventory';
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

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? 'The physical item could not be registered.';

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
  const [barcode, setBarcode] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
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
  const mutation = useMutation({
    mutationFn: () => inventoryApi.createItem(skuId, {
      locationId,
      assetCode: assetCode.trim(),
      barcode: barcode.trim() || undefined,
      condition: condition as 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED',
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice ? Math.round(Number(purchasePrice) * 100) : undefined,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-skus'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-overview'] }),
      ]);
      setOpen(false);
      setAssetCode('');
      setBarcode('');
      toast.success('Physical item registered');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const usableLocations = locations.data?.filter((location) => location.isActive && location.canStoreInventory) ?? [];
  const selectedSku = presetSku ?? skus.data?.data.find((sku) => sku.id === skuId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><PackagePlus className="mr-2 size-4" />Register item</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Register a physical item</DialogTitle>
          <DialogDescription>
            Create the permanent identity for one serialized rental piece. Money is entered in taka.
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
            <Label htmlFor="register-asset-code">Asset code</Label>
            <Input id="register-asset-code" value={assetCode} onChange={(event) => setAssetCode(event.target.value)} placeholder="DRS-RED-M-001" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="register-barcode">Barcode (optional)</Label>
            <Input id="register-barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
          </div>
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
        </div>
        {!usableLocations.length && !locations.isLoading ? <p className="text-sm text-destructive">Create an active storage location before registering items.</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!selectedSku || !locationId || !assetCode.trim() || mutation.isPending || !usableLocations.length} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Register item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
