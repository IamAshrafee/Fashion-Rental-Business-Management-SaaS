import { describe, expect, it } from 'vitest';
import { getPricingConfigDisplayEntries } from './product-pricing-display';

describe('product pricing display', () => {
  it('turns stored minor-unit pricing into a customer-facing price entry', () => {
    expect(getPricingConfigDisplayEntries({ unitPriceMinor: 10_000, minDays: 2 })).toEqual([
      {
        key: 'unitPriceMinor',
        label: 'Daily rental price',
        value: 10_000,
        isMoney: true,
      },
      {
        key: 'minDays',
        label: 'Minimum rental days',
        value: 2,
        isMoney: false,
      },
    ]);
  });
});
