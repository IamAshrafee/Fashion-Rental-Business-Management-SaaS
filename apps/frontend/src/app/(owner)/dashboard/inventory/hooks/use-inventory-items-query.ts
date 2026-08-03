'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InventoryItemsQuery } from '@/lib/api/inventory';

const DISPOSITIONS = new Set(['ACTIVE', 'QUARANTINED', 'LOST', 'RETIRED']);
const STATES = new Set(['AVAILABLE', 'PREPARING', 'READY', 'OUT_FOR_RENTAL', 'AWAITING_INSPECTION', 'CLEANING', 'WASHING', 'REPAIRING', 'IN_TRANSFER']);
const CONDITIONS = new Set(['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']);
const allowed = <T extends string>(value: string | null, values: Set<string>) => value && values.has(value) ? value as T : undefined;
const pageNumber = (value: string | null) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; };

type QueryUpdate = { [Key in keyof InventoryItemsQuery]?: InventoryItemsQuery[Key] | null };

export function useInventoryItemsQuery() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const query = useMemo<InventoryItemsQuery>(() => ({
    page: pageNumber(params.get('page')),
    limit: 25,
    search: params.get('q')?.trim() || undefined,
    locationId: params.get('location') || undefined,
    disposition: allowed<NonNullable<InventoryItemsQuery['disposition']>>(params.get('disposition'), DISPOSITIONS),
    operationalState: allowed<NonNullable<InventoryItemsQuery['operationalState']>>(params.get('state'), STATES),
    condition: allowed<NonNullable<InventoryItemsQuery['condition']>>(params.get('condition'), CONDITIONS),
  }), [params]);

  const update = useCallback((values: QueryUpdate, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    const mapped: Record<string, string | number | null | undefined> = { page: values.page, q: values.search, location: values.locationId, disposition: values.disposition, state: values.operationalState, condition: values.condition };
    if (resetPage && values.page === undefined) mapped.page = null;
    for (const [key, value] of Object.entries(mapped)) {
      if (value === undefined) continue;
      if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    startTransition(() => { const suffix = next.toString(); router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false }); });
  }, [params, pathname, router]);
  const clear = useCallback(() => startTransition(() => router.replace(pathname, { scroll: false })), [pathname, router]);
  return { query, update, clear, isNavigating };
}
