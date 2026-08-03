'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InventorySkuQuery } from '@/lib/api/inventory';

const TRACKING = new Set(['POOLED', 'SERIALIZED']);
const STOCK = new Set(['AVAILABLE', 'LOW_STOCK', 'UNAVAILABLE', 'UNCONFIGURED']);
const SORT = new Set(['PRODUCT', 'ON_HAND', 'AVAILABLE', 'RESERVED']);
const ORDER = new Set(['asc', 'desc']);

const allowed = <T extends string>(value: string | null, values: Set<string>) =>
  value && values.has(value) ? value as T : undefined;

const pageNumber = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export function useInventoryStockQuery() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const query = useMemo<InventorySkuQuery>(() => ({
    page: pageNumber(params.get('page')),
    limit: 25,
    search: params.get('q')?.trim() || undefined,
    trackingMode: allowed<NonNullable<InventorySkuQuery['trackingMode']>>(
      params.get('tracking'), TRACKING,
    ),
    locationId: params.get('location') || undefined,
    stockState: allowed<NonNullable<InventorySkuQuery['stockState']>>(
      params.get('state'), STOCK,
    ),
    sort: allowed<NonNullable<InventorySkuQuery['sort']>>(params.get('sort'), SORT) ?? 'PRODUCT',
    order: allowed<NonNullable<InventorySkuQuery['order']>>(params.get('order'), ORDER) ?? 'asc',
  }), [params]);

  type QueryUpdate = { [Key in keyof InventorySkuQuery]?: InventorySkuQuery[Key] | null };
  const update = useCallback((values: QueryUpdate, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    const mapped: Record<string, string | number | null | undefined> = {
      page: values.page,
      q: values.search,
      tracking: values.trackingMode,
      location: values.locationId,
      state: values.stockState,
      sort: values.sort,
      order: values.order,
    };
    if (resetPage && values.page === undefined) mapped.page = null;
    for (const [key, value] of Object.entries(mapped)) {
      if (value === undefined) continue;
      if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
      else if (key === 'sort' && value === 'PRODUCT') next.delete(key);
      else if (key === 'order' && value === 'asc') next.delete(key);
      else next.set(key, String(value));
    }
    startTransition(() => {
      const suffix = next.toString();
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    });
  }, [params, pathname, router]);

  const clear = useCallback(() => startTransition(() => router.replace(pathname, { scroll: false })), [pathname, router]);
  return { query, update, clear, isNavigating };
}
