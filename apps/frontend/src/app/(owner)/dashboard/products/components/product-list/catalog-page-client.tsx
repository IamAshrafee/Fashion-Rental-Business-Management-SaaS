'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  FolderTree,
  Layers,
  Plus,
  Ruler,
  Settings2,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  OwnerListEmpty,
  OwnerListError,
  OwnerTableSkeleton,
} from '@/components/owner/workspace';
import { productApi } from '@/lib/api/products';
import { useCategories, useProductTypes } from '../../hooks/use-product-apis';
import { useProductListQuery } from '../../hooks/use-product-list-query';
import { CatalogToolbar } from './catalog-toolbar';
import { ProductsDataTable } from './data-table';

export function CatalogPageClient() {
  const { query, updateQuery, clearFilters, isNavigating } = useProductListQuery();
  const categories = useCategories();
  const productTypes = useProductTypes();
  const products = useQuery({
    queryKey: ['products', 'list', query],
    queryFn: () => productApi.list(query),
    placeholderData: (previous) => previous,
  });

  const hasFilters = Boolean(
    query.search ||
    query.status ||
    query.categoryId ||
    query.productTypeId ||
    query.trackingMode ||
    query.readiness ||
    query.stockState,
  );
  const isPending = isNavigating || products.isFetching;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Product catalog"
        description="Build rentable products, complete their setup, and connect them to inventory."
        className="mb-0"
        actions={(
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Settings2 data-icon="inline-start" />Catalog setup
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Catalog structure</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/products/categories"><FolderTree />Categories</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/products/product-types"><Layers />Product types</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/products/sizing-schemas"><Ruler />Size systems</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/products/events"><CalendarDays />Events</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/products/trash"><Trash2 />Trash</Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link href="/dashboard/products/new"><Plus data-icon="inline-start" />Add product</Link>
            </Button>
          </>
        )}
      />

      <CatalogToolbar
        query={query}
        categories={categories.data ?? []}
        productTypes={productTypes.data ?? []}
        isPending={isPending}
        onChange={updateQuery}
        onClear={clearFilters}
      />

      {products.isLoading ? (
        <OwnerTableSkeleton columns={7} />
      ) : products.isError ? (
        <OwnerListError
          message={products.error instanceof Error ? products.error.message : 'Please try again.'}
          onRetry={() => products.refetch()}
        />
      ) : (products.data?.data.length ?? 0) === 0 ? (
        <OwnerListEmpty
          title={hasFilters ? 'No products match these filters' : 'Create your first rentable product'}
          description={
            hasFilters
              ? 'Clear or adjust the filters to return to the full catalog.'
              : 'Start with the catalog details, then add variants, pricing, media, and inventory.'
          }
          action={hasFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters}>Clear filters</Button>
          ) : (
            <Button asChild><Link href="/dashboard/products/new"><Plus data-icon="inline-start" />Add product</Link></Button>
          )}
        />
      ) : (
        <ProductsDataTable
          data={products.data?.data ?? []}
          meta={products.data!.meta}
          isPending={isPending}
          onPageChange={(page) => updateQuery({ page }, { resetPage: false })}
        />
      )}
    </div>
  );
}
