'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, FolderTree, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ProductsDataTable, type ProductRow } from './components/product-list/data-table';
import { productApi, type ProductListQuery } from '@/lib/api/products';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ProductsPage() {
  const [query] = useState<ProductListQuery>({ page: 1, limit: 50 });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['products', 'list', query],
    queryFn: () => productApi.list(query),
  });

  // Map API response to the shape the data table expects
  const products: ProductRow[] = (data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.category?.name ?? 'Uncategorized',
    status: p.status as 'published' | 'draft' | 'archived',
    price: p.rentalPrice,
    targetRentals: p.targetRentals,
    totalOrders: p._count?.bookingItems ?? p.totalBookings ?? 0,
    thumbnailUrl: p.variants?.[0]?.images?.find(i => i.isFeatured)?.url
      ?? p.variants?.[0]?.images?.[0]?.url,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Products"
          description="Manage your inventory and rental catalog"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/products/categories">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/products/trash">
              <Trash2 className="h-4 w-4 mr-2" />
              Trash
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load products. {(error as Error)?.message || 'Please try again.'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="bg-card text-card-foreground">
          <ProductsDataTable data={products} />
        </div>
      )}
    </div>
  );
}
