'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type {
  OwnerCategory,
  ProductListQuery,
  ProductTypeData,
} from '@/lib/api/products';
import type { ProductListQueryUpdate } from '../../hooks/use-product-list-query';

interface CatalogToolbarProps {
  query: ProductListQuery;
  categories: OwnerCategory[];
  productTypes: ProductTypeData[];
  isPending: boolean;
  onChange: (update: ProductListQueryUpdate) => void;
  onClear: () => void;
}

export function CatalogToolbar({
  query,
  categories,
  productTypes,
  isPending,
  onChange,
  onClear,
}: CatalogToolbarProps) {
  const [search, setSearch] = useState(query.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => setSearch(query.search ?? ''), [query.search]);

  useEffect(() => {
    if (debouncedSearch !== (query.search ?? '')) {
      onChange({ search: debouncedSearch || null });
    }
  }, [debouncedSearch, onChange, query.search]);

  const hasFilters = Boolean(
    query.search ||
    query.status ||
    query.categoryId ||
    query.productTypeId ||
    query.readiness ||
    query.stockState ||
    query.sort !== 'updatedAt' ||
    query.order !== 'desc',
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,auto))]">
        <div className="relative">
          <label htmlFor="catalog-search" className="sr-only">Search catalog</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="catalog-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products or slugs"
            className="pl-9"
          />
        </div>

        <Select
          value={query.status ?? 'all'}
          onValueChange={(value) => onChange({
            status: value === 'all' ? null : value as NonNullable<ProductListQuery['status']>,
          })}
        >
          <SelectTrigger aria-label="Filter by publication status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={query.readiness ?? 'all'}
          onValueChange={(value) => onChange({
            readiness: value === 'all' ? null : value as NonNullable<ProductListQuery['readiness']>,
          })}
        >
          <SelectTrigger aria-label="Filter by product readiness">
            <SelectValue placeholder="All readiness" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All readiness</SelectItem>
              <SelectItem value="ready">Ready to publish</SelectItem>
              <SelectItem value="needs_attention">Needs attention</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={`${query.sort ?? 'updatedAt'}-${query.order ?? 'desc'}`}
          onValueChange={(value) => {
            const [sort, order] = value.split('-') as [
              NonNullable<ProductListQuery['sort']>,
              NonNullable<ProductListQuery['order']>,
            ];
            onChange({ sort, order });
          }}
        >
          <SelectTrigger aria-label="Sort products">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="updatedAt-desc">Recently updated</SelectItem>
              <SelectItem value="createdAt-desc">Newest created</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
              <SelectItem value="status-asc">Status</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={query.categoryId ?? 'all'}
          onValueChange={(value) => onChange({ categoryId: value === 'all' ? null : value })}
        >
          <SelectTrigger aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={query.productTypeId ?? 'all'}
          onValueChange={(value) => onChange({ productTypeId: value === 'all' ? null : value })}
        >
          <SelectTrigger aria-label="Filter by product type">
            <SelectValue placeholder="All product types" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All product types</SelectItem>
              {productTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={query.stockState ?? 'all'}
          onValueChange={(value) => onChange({
            stockState: value === 'all' ? null : value as NonNullable<ProductListQuery['stockState']>,
          })}
        >
          <SelectTrigger aria-label="Filter by stock state">
            <SelectValue placeholder="All stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in_stock">Has stock</SelectItem>
              <SelectItem value="no_stock">No stock</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          disabled={!hasFilters || isPending}
          onClick={() => {
            setSearch('');
            onClear();
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Clear filters
        </Button>
      </div>
    </div>
  );
}
