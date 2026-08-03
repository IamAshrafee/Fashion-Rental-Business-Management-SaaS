'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { BookingListQuery } from '@/lib/api/bookings';

const QUEUES = new Set(['REVIEW', 'ASSIGNMENT', 'HANDOFF', 'ACTIVE', 'RETURN_INSPECTION', 'OVERDUE', 'CLOSED']);
const PAYMENTS = new Set(['unpaid', 'partial', 'paid']);
const SORTS = new Set(['createdAt', 'grandTotal']);
const ORDERS = new Set(['asc', 'desc']);
const allowed = <T extends string>(value: string | null, set: Set<string>) => value && set.has(value) ? value as T : undefined;
const positivePage = (value: string | null) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; };
type BookingQueryUpdate = { [Key in keyof BookingListQuery]?: BookingListQuery[Key] | null };

export function useBookingListQuery() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const query = useMemo<BookingListQuery>(() => ({
    page: positivePage(params.get('page')),
    limit: 20,
    search: params.get('q')?.trim() || undefined,
    queue: allowed<NonNullable<BookingListQuery['queue']>>(params.get('queue'), QUEUES),
    paymentStatus: allowed<string>(params.get('payment'), PAYMENTS),
    itemDateFrom: params.get('rentalFrom') || undefined,
    itemDateTo: params.get('rentalTo') || undefined,
    sort: allowed<NonNullable<BookingListQuery['sort']>>(params.get('sort'), SORTS) ?? 'createdAt',
    order: allowed<NonNullable<BookingListQuery['order']>>(params.get('order'), ORDERS) ?? 'desc',
  }), [params]);

  const update = useCallback((values: BookingQueryUpdate, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    const mapped: Record<string, string | number | null | undefined> = {
      page: values.page,
      q: values.search,
      queue: values.queue,
      payment: values.paymentStatus,
      rentalFrom: values.itemDateFrom,
      rentalTo: values.itemDateTo,
      sort: values.sort,
      order: values.order,
    };
    if (resetPage && values.page === undefined) mapped.page = null;
    for (const [key, value] of Object.entries(mapped)) {
      if (value === undefined) continue;
      if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
      else if (key === 'sort' && value === 'createdAt') next.delete(key);
      else if (key === 'order' && value === 'desc') next.delete(key);
      else next.set(key, String(value));
    }
    startTransition(() => { const suffix = next.toString(); router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false }); });
  }, [params, pathname, router]);
  const clear = useCallback(() => startTransition(() => router.replace(pathname, { scroll: false })), [pathname, router]);
  return { query, update, clear, isNavigating };
}
