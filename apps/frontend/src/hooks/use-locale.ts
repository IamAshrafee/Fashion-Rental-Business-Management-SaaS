'use client';

/**
 * Locale formatting hook — uses the current tenant's locale for
 * price, date, and number formatting.
 */

import { useTenant } from '@/hooks/use-tenant';
import {
  formatPrice as fp,
  formatDate as fd,
  formatDateTime as fdt,
  formatRentalDate as frd,
  formatNumber as fn,
} from '@/lib/locale';

export function useLocale() {
  const { locale } = useTenant();

  return {
    /** Format an integer amount as a price string: 7500 → "৳7,500" */
    formatPrice: (amount: number) => fp(amount, locale),

    /** Format a date using tenant's date format: "28/03/2026" */
    formatDate: (date: Date | string) => fd(date, locale),

    /** Format a date with time in tenant's timezone */
    formatDateTime: (date: Date | string) => fdt(date, locale),

    /** Format a rental date string (YYYY-MM-DD, no TZ conversion) */
    formatRentalDate: (dateStr: string) => frd(dateStr, locale),

    /** Format a number with thousands separators */
    formatNumber: (value: number) => fn(value, locale.numberFormat),

    /** The raw locale config (for advanced usage) */
    locale,
  };
}
