/**
 * Locale Formatting Utilities — ClosetRent
 *
 * All money = integers (ADR-04). Formatting is frontend-only.
 * Uses tenant locale settings for currency, date, and number formatting.
 */

import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { TenantLocale } from '@/types';

// ----------------------------------------------------------------
// Number Formatting
// ----------------------------------------------------------------

/**
 * Format a number using South Asian notation (12,34,567)
 * or International notation (1,234,567).
 */
export function formatNumber(
  value: number,
  style: 'south_asian' | 'international' = 'international',
): string {
  if (style === 'south_asian') {
    return formatSouthAsian(value);
  }
  return formatInternational(value);
}

function formatSouthAsian(n: number): string {
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const str = abs.toString();

  if (str.length <= 3) return (isNeg ? '-' : '') + str;

  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);

  // Group every 2 digits from right in the remaining part
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (isNeg ? '-' : '') + grouped + ',' + last3;
}

function formatInternational(n: number): string {
  return n.toLocaleString('en-US');
}

// ----------------------------------------------------------------
// Price Formatting (ADR-04: money = Int)
// ----------------------------------------------------------------

/**
 * Format an integer amount as a price string with the tenant's currency.
 *
 * @example formatPrice(7500, locale) → "৳7,500" or "7,500৳"
 */
export function formatPrice(
  amount: number,
  locale?: TenantLocale,
): string {
  // Defaults for when there's no tenant context yet
  const symbol = locale?.currency?.symbol ?? '৳';
  const position = locale?.currency?.symbolPosition ?? 'before';
  const numberStyle = locale?.numberFormat ?? 'south_asian';

  const formatted = formatNumber(amount, numberStyle);

  return position === 'before'
    ? `${symbol}${formatted}`
    : `${formatted}${symbol}`;
}

// ----------------------------------------------------------------
// Date Formatting
// ----------------------------------------------------------------

/** date-fns format tokens for each supported date format */
const DATE_FORMAT_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
};

/**
 * Format a Date or ISO string for display using the tenant's date format.
 */
export function formatDate(
  date: Date | string,
  locale?: TenantLocale,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pattern = DATE_FORMAT_MAP[locale?.dateFormat ?? 'DD/MM/YYYY'] ?? 'dd/MM/yyyy';
  return format(d, pattern);
}

/**
 * Format a Date or ISO string in the tenant's timezone.
 */
export function formatDateTime(
  date: Date | string,
  locale?: TenantLocale,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const tz = locale?.timezone ?? 'UTC';
  const datePattern = DATE_FORMAT_MAP[locale?.dateFormat ?? 'DD/MM/YYYY'] ?? 'dd/MM/yyyy';
  const timePattern = locale?.timeFormat === '24h' ? 'HH:mm' : 'hh:mm a';
  return formatInTimeZone(d, tz, `${datePattern} ${timePattern}`);
}

/**
 * Format a rental date (Date type, no timezone conversion).
 * Rental dates are DATE columns — calendar dates only.
 */
export function formatRentalDate(
  dateStr: string,
  locale?: TenantLocale,
): string {
  // dateStr is "YYYY-MM-DD" — parse without TZ conversion
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const pattern = DATE_FORMAT_MAP[locale?.dateFormat ?? 'DD/MM/YYYY'] ?? 'dd/MM/yyyy';
  return format(d, pattern);
}
