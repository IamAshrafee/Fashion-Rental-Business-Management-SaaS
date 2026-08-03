'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ProductListQuery } from '@/lib/api/products';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT: NonNullable<ProductListQuery['sort']> = 'updatedAt';
const DEFAULT_ORDER: NonNullable<ProductListQuery['order']> = 'desc';

const PRODUCT_STATUSES = new Set(['draft', 'published', 'archived']);
const TRACKING_MODES = new Set(['POOLED', 'SERIALIZED']);
const READINESS_STATES = new Set(['ready', 'needs_attention']);
const STOCK_STATES = new Set(['in_stock', 'no_stock']);
const SORT_FIELDS = new Set(['name', 'status', 'createdAt', 'updatedAt']);
const SORT_ORDERS = new Set(['asc', 'desc']);

function positiveInteger(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}

function allowed<T extends string>(
  value: string | null,
  values: Set<string>,
): T | undefined {
  return value && values.has(value) ? (value as T) : undefined;
}

export type ProductListQueryUpdate = {
  [Key in keyof ProductListQuery]?: ProductListQuery[Key] | null;
};

export function useProductListQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const query = useMemo<ProductListQuery>(() => ({
    page: positiveInteger(searchParams.get('page'), DEFAULT_PAGE),
    limit: positiveInteger(searchParams.get('limit'), DEFAULT_LIMIT, 100),
    search: searchParams.get('q')?.trim() || undefined,
    status: allowed<NonNullable<ProductListQuery['status']>>(
      searchParams.get('status'),
      PRODUCT_STATUSES,
    ),
    categoryId: searchParams.get('category') || undefined,
    productTypeId: searchParams.get('type') || undefined,
    trackingMode: allowed<NonNullable<ProductListQuery['trackingMode']>>(
      searchParams.get('tracking'),
      TRACKING_MODES,
    ),
    readiness: allowed<NonNullable<ProductListQuery['readiness']>>(
      searchParams.get('readiness'),
      READINESS_STATES,
    ),
    stockState: allowed<NonNullable<ProductListQuery['stockState']>>(
      searchParams.get('stock'),
      STOCK_STATES,
    ),
    sort: allowed<NonNullable<ProductListQuery['sort']>>(
      searchParams.get('sort'),
      SORT_FIELDS,
    ) ?? DEFAULT_SORT,
    order: allowed<NonNullable<ProductListQuery['order']>>(
      searchParams.get('order'),
      SORT_ORDERS,
    ) ?? DEFAULT_ORDER,
  }), [searchParams]);

  const updateQuery = useCallback((
    update: ProductListQueryUpdate,
    options: { resetPage?: boolean } = {},
  ) => {
    const next = new URLSearchParams(searchParams.toString());
    const normalizedUpdate: Record<string, string | number | null | undefined> = {
      page: update.page,
      limit: update.limit,
      q: update.search,
      status: update.status,
      category: update.categoryId,
      type: update.productTypeId,
      tracking: update.trackingMode,
      readiness: update.readiness,
      stock: update.stockState,
      sort: update.sort,
      order: update.order,
    };

    if (options.resetPage !== false && update.page === undefined) {
      normalizedUpdate.page = DEFAULT_PAGE;
    }

    for (const [key, value] of Object.entries(normalizedUpdate)) {
      if (value === undefined) continue;
      if (value === null || value === '') {
        next.delete(key);
        continue;
      }
      const isDefault =
        (key === 'page' && value === DEFAULT_PAGE) ||
        (key === 'limit' && value === DEFAULT_LIMIT) ||
        (key === 'sort' && value === DEFAULT_SORT) ||
        (key === 'order' && value === DEFAULT_ORDER);
      if (isDefault) next.delete(key);
      else next.set(key, String(value));
    }

    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  const clearFilters = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  return { query, updateQuery, clearFilters, isNavigating };
}
