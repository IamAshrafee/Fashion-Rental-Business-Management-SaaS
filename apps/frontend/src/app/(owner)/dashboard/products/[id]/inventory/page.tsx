'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  History,
  Loader2,
  PackagePlus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  productApi,
  type InventoryTrackingMode,
  type ProductInventorySize,
  type StockUnit,
} from '@/lib/api/products';
import { inventoryApi } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function statusVariant(
  disposition: StockUnit['disposition'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (disposition === 'ACTIVE') return 'default';
  if (disposition === 'QUARANTINED') return 'secondary';
  if (disposition === 'LOST') return 'destructive';
  return 'outline';
}

function apiErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
  );
}

function isoDate(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function MovementHistory({ variantSizeId }: { variantSizeId: string }) {
  const movements = useQuery({
    queryKey: ['inventory-movements', variantSizeId],
    queryFn: () => productApi.listInventoryMovements(variantSizeId),
  });
  if (!movements.data?.length) return null;
  return (
    <div className="space-y-2 border-t pt-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4" />
        Recent movement history
      </p>
      <div className="space-y-2">
        {movements.data.slice(0, 5).map((movement) => (
          <div
            key={movement.id}
            className="flex items-start justify-between gap-3 rounded-md bg-muted/30 p-2.5 text-xs"
          >
            <div>
              <p className="font-medium">{movement.movementType.replaceAll('_', ' ')}</p>
              <p className="text-muted-foreground">
                {movement.stockUnit?.assetCode || movement.reason || 'Inventory updated'}
                {movement.actor ? ` · ${movement.actor.fullName}` : ''}
              </p>
            </div>
            <time className="shrink-0 text-muted-foreground">
              {new Date(movement.createdAt).toLocaleDateString()}
            </time>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvailabilityCalendar({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from] = useState(() => isoDate(-30));
  const [to] = useState(() => isoDate(120));
  const [startDate, setStartDate] = useState(() => isoDate());
  const [endDate, setEndDate] = useState(() => isoDate());
  const [reason, setReason] = useState('');
  const calendar = useQuery({
    queryKey: ['inventory-calendar', productId, from, to],
    queryFn: () => productApi.getInventoryCalendar(productId, from, to),
  });

  const createBlock = useMutation({
    mutationFn: () =>
      productApi.createInventoryBlock({
        productId,
        startDate,
        endDate,
        blockType: 'MANUAL',
        reason,
      }),
    onSuccess: async () => {
      setOpen(false);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['inventory-calendar', productId] });
      toast.success('Product availability block created');
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Could not create block')),
  });
  const deleteBlock = useMutation({
    mutationFn: productApi.deleteInventoryBlock,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-calendar', productId] });
      toast.success('Block removed');
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Could not remove block')),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Availability calendar
            </CardTitle>
            <CardDescription>
              Reservations and operational blocks for the next four months.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Block dates
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block product dates</DialogTitle>
                <DialogDescription>
                  Use this when the whole product must be unavailable, regardless of size or
                  physical unit.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="block-start">From</Label>
                  <Input
                    id="block-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="block-end">To</Label>
                  <Input
                    id="block-end"
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="block-reason">Reason</Label>
                  <Input
                    id="block-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Photoshoot, repair, private hold…"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!startDate || !endDate || createBlock.isPending}
                  onClick={() => createBlock.mutate()}
                >
                  Create block
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {calendar.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading calendar…
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-semibold">{calendar.data?.reservations.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active reservations</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-semibold">{calendar.data?.blocks.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Inventory blocks</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-semibold">
                {calendar.data?.reservations.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ??
                  0}
              </p>
              <p className="text-xs text-muted-foreground">Pieces reserved</p>
            </div>
          </div>
        )}
        {(calendar.data?.blocks.length ?? 0) > 0 && (
          <div className="mt-4 space-y-2">
            {calendar.data?.blocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{block.blockType} block</p>
                  <p className="text-xs text-muted-foreground">
                    {block.startDate?.slice(0, 10)} → {block.endDate?.slice(0, 10)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove block"
                  disabled={deleteBlock.isPending}
                  onClick={() => deleteBlock.mutate(block.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SerializedUnits({ productId, sku }: { productId: string; sku: ProductInventorySize }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [assetCode, setAssetCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [locationId, setLocationId] = useState('');
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });

  const unitsQuery = useQuery({
    queryKey: ['stock-units', sku.variantSizeId],
    queryFn: () => productApi.listStockUnits(sku.variantSizeId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stock-units', sku.variantSizeId] }),
      queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] }),
    ]);
  };

  const createUnit = useMutation({
    mutationFn: () =>
      productApi.createStockUnit(sku.variantSizeId, { assetCode, barcode, locationId }),
    onSuccess: async () => {
      setOpen(false);
      setAssetCode('');
      setBarcode('');
      setLocationId('');
      await refresh();
      toast.success('Physical unit registered');
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Could not register unit')),
  });

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Physical units</p>
          <p className="text-xs text-muted-foreground">
            Each rentable piece has its own asset identity and lifecycle.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PackagePlus className="mr-2 h-4 w-4" />
              Register unit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register physical unit</DialogTitle>
              <DialogDescription>
                Add the label staff will use to identify this exact piece.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor={`asset-${sku.variantSizeId}`}>Asset code</Label>
                <Input
                  id={`asset-${sku.variantSizeId}`}
                  value={assetCode}
                  onChange={(event) => setAssetCode(event.target.value)}
                  placeholder="e.g. SHR-RED-M-01"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`barcode-${sku.variantSizeId}`}>Barcode (optional)</Label>
                <Input
                  id={`barcode-${sku.variantSizeId}`}
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Inventory location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.data
                      ?.filter((location) => location.canStoreInventory)
                      .map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!assetCode.trim() || !locationId || createUnit.isPending}
                onClick={() => createUnit.mutate()}
              >
                {createUnit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Register
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {unitsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading units…
        </div>
      ) : unitsQuery.data?.length ? (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Operational state</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitsQuery.data.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-mono text-xs">{unit.assetCode}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(unit.disposition)}>{unit.disposition}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{unit.operationalState.replaceAll('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>{unit.condition}</TableCell>
                  <TableCell>{unit.location?.name || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/products/${productId}/inventory/${unit.id}`}>
                        Manage <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
          No physical units registered yet.
        </p>
      )}
    </div>
  );
}

function PoolLocationRow({
  productId,
  sku,
  locationId,
  locationName,
}: {
  productId: string;
  sku: ProductInventorySize;
  locationId: string;
  locationName: string;
}) {
  const queryClient = useQueryClient();
  const existing = sku.pools.find((pool) => pool.location.id === locationId);
  const [quantity, setQuantity] = useState(existing?.onHandQuantity ?? 0);
  const [threshold, setThreshold] = useState(existing?.reorderThreshold ?? 0);
  const update = useMutation({
    mutationFn: () =>
      inventoryApi.setPoolQuantity(sku.variantSizeId, {
        locationId,
        onHandQuantity: quantity,
        reorderThreshold: threshold,
        reason: `Stock count updated for ${locationName}`,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] });
      toast.success(`${locationName} stock updated`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update pooled stock')),
  });
  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_130px_130px_auto] sm:items-end">
      <div>
        <p className="font-medium">{locationName}</p>
        <p className="text-xs text-muted-foreground">
          {existing?.reservedQuantity ?? 0} reserved today
        </p>
      </div>
      <div className="grid gap-1">
        <Label>On hand</Label>
        <Input
          type="number"
          min={0}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
        />
      </div>
      <div className="grid gap-1">
        <Label>Low-stock alert</Label>
        <Input
          type="number"
          min={0}
          value={threshold}
          onChange={(event) => setThreshold(Math.max(0, Number(event.target.value) || 0))}
        />
      </div>
      <Button
        size="sm"
        disabled={
          update.isPending ||
          (quantity === (existing?.onHandQuantity ?? 0) &&
            threshold === (existing?.reorderThreshold ?? 0))
        }
        onClick={() => update.mutate()}
      >
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
      </Button>
    </div>
  );
}

function PooledPools({ productId, sku }: { productId: string; sku: ProductInventorySize }) {
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryApi.listLocations(),
  });
  return (
    <div className="space-y-2 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Stock by location</p>
        <p className="text-xs text-muted-foreground">
          Pooled quantities are counted independently at every inventory location.
        </p>
      </div>
      {locations.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading locations…</p>
      ) : (
        locations.data
          ?.filter((location) => location.canStoreInventory)
          .map((location) => (
            <PoolLocationRow
              key={location.id}
              productId={productId}
              sku={sku}
              locationId={location.id}
              locationName={location.name}
            />
          ))
      )}
    </div>
  );
}

function InventorySkuCard({ productId, sku }: { productId: string; sku: ProductInventorySize }) {
  const queryClient = useQueryClient();

  const configure = useMutation({
    mutationFn: (trackingMode: InventoryTrackingMode) =>
      productApi.configureInventory(sku.variantSizeId, {
        trackingMode,
        reason: 'Updated from inventory workspace',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] });
      toast.success('Inventory configuration saved');
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Could not update inventory')),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Size {sku.sizeInstance.displayLabel}</CardTitle>
            <CardDescription>{sku.sizeInstance.normalizedKey}</CardDescription>
          </div>
          <Badge variant={sku.availableQuantity > 0 ? 'default' : 'destructive'}>
            {sku.availableQuantity} available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3 text-center">
          <div>
            <p className="text-lg font-semibold">{sku.totalCapacity}</p>
            <p className="text-xs text-muted-foreground">Capacity</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{sku.reservedQuantity}</p>
            <p className="text-xs text-muted-foreground">Reserved today</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{sku.availableQuantity}</p>
            <p className="text-xs text-muted-foreground">Free today</p>
          </div>
        </div>
        <div className="grid max-w-sm gap-2">
          <div className="grid gap-2">
            <Label>Tracking mode</Label>
            <Select
              value={sku.trackingMode}
              disabled={configure.isPending}
              onValueChange={(trackingMode: InventoryTrackingMode) =>
                configure.mutate(trackingMode)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POOLED">Pooled quantity</SelectItem>
                <SelectItem value="SERIALIZED">Individual units</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {sku.trackingMode === 'POOLED' && <PooledPools productId={productId} sku={sku} />}
        {sku.trackingMode === 'SERIALIZED' && <SerializedUnits productId={productId} sku={sku} />}
        <MovementHistory variantSizeId={sku.variantSizeId} />
      </CardContent>
    </Card>
  );
}

export default function ProductInventoryPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const inventoryQuery = useQuery({
    queryKey: ['product-inventory', id],
    queryFn: () => productApi.getInventory(id),
    enabled: !!id,
  });
  const updateVisibility = useMutation({
    mutationFn: (storefrontItemMode: 'INTERNAL_ONLY' | 'CONDITION_SUMMARY' | 'SPECIFIC_ITEM_SELECTION') =>
      productApi.updateProduct(id, { storefrontItemMode }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['product-inventory', id] });
      toast.success('Storefront item visibility updated');
    },
    onError: (error: unknown) =>
      toast.error(apiErrorMessage(error, 'Could not update storefront visibility')),
  });

  if (inventoryQuery.isLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  if (inventoryQuery.isError || !inventoryQuery.data)
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard/products/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to product
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Inventory could not be loaded.
          </CardContent>
        </Card>
      </div>
    );

  const product = inventoryQuery.data;
  const skus = product.variants.flatMap((variant) =>
    variant.sizes.map((sku) => ({ variant, sku })),
  );
  const totalCapacity = skus.reduce((sum, item) => sum + item.sku.totalCapacity, 0);
  const available = skus.reduce((sum, item) => sum + item.sku.availableQuantity, 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href={`/dashboard/products/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to product
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory · {product.name}</h1>
          <p className="text-sm text-muted-foreground">
            Manage pooled quantities and individually tracked rental pieces from one workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{skus.length} SKUs</Badge>
          <Badge variant="outline">{totalCapacity} capacity</Badge>
          <Badge>{available} available today</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer-facing physical item policy</CardTitle>
          <CardDescription>
            Keep pieces internal, show anonymous condition counts, or let customers select an approved serialized piece.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <Select
            value={product.storefrontItemMode}
            disabled={updateVisibility.isPending}
            onValueChange={(value) =>
              updateVisibility.mutate(
                value as 'INTERNAL_ONLY' | 'CONDITION_SUMMARY' | 'SPECIFIC_ITEM_SELECTION',
              )
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERNAL_ONLY">Internal assignment only</SelectItem>
              <SelectItem value="CONDITION_SUMMARY">Show condition summary</SelectItem>
              <SelectItem value="SPECIFIC_ITEM_SELECTION">Customer selects a piece</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <AvailabilityCalendar productId={id} />

      {skus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Boxes className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="font-medium">No inventory SKUs yet</p>
              <p className="text-sm text-muted-foreground">
                Edit the product and select at least one size for a variant.
              </p>
            </div>
            <Button asChild>
              <Link href={`/dashboard/products/${id}/edit`}>Edit product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        product.variants.map((variant) => (
          <section key={variant.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: variant.mainColor.hexCode || '#ddd' }}
              />
              <h2 className="font-medium">{variant.variantName || variant.mainColor.name}</h2>
              <span className="text-xs text-muted-foreground">
                {variant.sizes.length} size{variant.sizes.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {variant.sizes.map((sku) => (
                <InventorySkuCard key={sku.variantSizeId} productId={id} sku={sku} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
