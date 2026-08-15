import { describe, expect, it } from 'vitest';
import type { TenantLocale } from '@/types';
import { formatPrice } from './locale';

const locale: TenantLocale = {
  country: 'BD',
  timezone: 'Asia/Dhaka',
  currency: { code: 'BDT', symbol: '৳', symbolPosition: 'before' },
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'south_asian',
  timeFormat: '12h',
  weekStart: 'saturday',
};

describe('formatPrice', () => {
  it('formats minor units as major currency values', () => {
    expect(formatPrice(7500, locale)).toBe('৳75');
    expect(formatPrice(7550, locale)).toBe('৳75.5');
    expect(formatPrice(75, locale)).toBe('৳0.75');
  });

  it('preserves tenant symbol placement and grouping preference', () => {
    expect(
      formatPrice(123456700, {
        ...locale,
        currency: { ...locale.currency, symbolPosition: 'after' },
      }),
    ).toBe('12,34,567৳');
    expect(formatPrice(123456700, { ...locale, numberFormat: 'international' })).toBe(
      '৳1,234,567',
    );
  });
});
