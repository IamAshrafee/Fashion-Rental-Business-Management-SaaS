'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes, CalendarOff, Loader2, PackagePlus } from 'lucide-react';
import { productApi, type ProductInventorySize } from '@/lib/api/products';
import type { InventorySku } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldTip } from '@/components/shared/field-tip';

function skuProjection(
  product: Awaited<ReturnType<typeof productApi.getInventory>>,
  variant: Awaited<ReturnType<typeof productApi.getInventory>>['variants'][number],
  size: ProductInventorySize,
): InventorySku {
  const physicalItemCount = size.unitCounts.reduce((sum, row) => sum + row.quantity, 0);
  const operationallyAvailableCount = size.unitCounts
    .filter((row) => row.disposition === 'ACTIVE' && row.operationalState === 'AVAILABLE')
    .reduce((sum, row) => sum + row.quantity, 0);
  return {
    id: size.variantSizeId,
    productId: product.id,
    productName: product.name,
    productStatus: product.status,
    variantId: variant.id,
    variantName: variant.variantName,
    sizeLabel: size.sizeInstance.displayLabel,
    physicalItemCount,
    activeItemCount: size.totalCapacity,
    operationallyAvailableCount,
    onHandQuantity: size.totalCapacity,
    reservedQuantity: size.reservedQuantity,
    availableQuantity: size.availableQuantity,
    inventoryState: physicalItemCount === 0
      ? 'UNCONFIGURED'
      : size.availableQuantity > 0
        ? 'AVAILABLE'
        : 'UNAVAILABLE',
  };
}

export default function ProductInventoryPage() {
  const productId = useParams<{ id: string }>().id;
  const query = useQuery({
    queryKey: ['product-inventory', productId],
    queryFn: () => productApi.getInventory(productId),
    enabled: Boolean(productId),
  });

  if (query.isLoading) {
    return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="size-7 animate-spin text-muted-foreground" /></div>;
  }
  if (query.isError || !query.data) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        <p>Product inventory could not be loaded.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const product = query.data;
  const skus = product.variants.flatMap((variant) =>
    variant.sizes.map((size) => ({ variant, size, sku: skuProjection(product, variant, size) })),
  );
  const physicalItems = skus.reduce((sum, row) => sum + row.sku.physicalItemCount, 0);
  const activeItems = skus.reduce((sum, row) => sum + row.sku.activeItemCount, 0);
  const reserved = skus.reduce((sum, row) => sum + row.sku.reservedQuantity, 0);
  const available = skus.reduce((sum, row) => sum + row.sku.availableQuantity, 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-3" asChild>
            <Link href={`/dashboard/products/${productId}`}><ArrowLeft className="mr-2 size-4" />Back to product</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name} inventory</h1>
          <p className="text-sm text-muted-foreground">
            Register, locate, and operate the exact physical items available for each catalog SKU.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/dashboard/inventory/items/register?productId=${encodeURIComponent(productId)}&returnTo=${encodeURIComponent(`/dashboard/products/${productId}/inventory`)}`}><PackagePlus className="mr-2 size-4" />Register physical items</Link></Button>
          <Button variant="outline" asChild><Link href="/dashboard/inventory/availability"><CalendarOff className="mr-2 size-4" />Availability rules</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Registered physical items', physicalItems, 'Every identity, including quarantined, lost, or retired records.'],
          ['Active items', activeItems, 'Physical pieces still owned and eligible for operations.'],
          ['Reserved now', reserved, 'Current rental demand against these SKUs.'],
          ['Available now', available, 'Operationally available pieces after current demand.'],
        ].map(([label, value, help]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label} <FieldTip tip={String(help)} /></CardDescription>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4" />Stock by SKU</CardTitle>
          <CardDescription>
            Catalog SKUs can exist with zero stock. Rental capacity begins only when physical items are registered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {!skus.length ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground md:col-span-2">
              This product has no rentable SKUs yet. Add a variant and size in Edit Product first.
            </div>
          ) : skus.map(({ variant, size, sku }) => (
            <div key={size.variantSizeId} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{variant.variantName || variant.mainColor.name}</p>
                  <p className="text-sm text-muted-foreground">Size {size.sizeInstance.displayLabel}</p>
                </div>
                <Badge variant={sku.availableQuantity > 0 ? 'secondary' : 'outline'}>
                  {sku.availableQuantity > 0 ? `${sku.availableQuantity} available` : 'No availability'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><p className="font-semibold">{sku.physicalItemCount}</p><p className="text-xs text-muted-foreground">Registered</p></div>
                <div><p className="font-semibold">{sku.activeItemCount}</p><p className="text-xs text-muted-foreground">Active</p></div>
                <div><p className="font-semibold">{sku.reservedQuantity}</p><p className="text-xs text-muted-foreground">Reserved</p></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild><Link href={`/dashboard/inventory/items/register?productId=${encodeURIComponent(productId)}&variantSizeId=${encodeURIComponent(sku.id)}&returnTo=${encodeURIComponent(`/dashboard/products/${productId}/inventory`)}`}><PackagePlus className="mr-2 size-4" />Add item</Link></Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link href={`/dashboard/inventory/items?variantSizeId=${size.variantSizeId}`}>View items</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
