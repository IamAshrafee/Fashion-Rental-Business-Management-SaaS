import { describe, expect, it } from 'vitest';
import type { ProductReadinessBlocker } from '@/lib/api/products';
import {
  getProductReadinessFixHref,
  getProductReadinessGuidance,
} from './product-readiness-guidance';

const blocker = (code: ProductReadinessBlocker['code']): ProductReadinessBlocker => ({
  code,
  section: code === 'COMPOSITION' ? 'composition' : 'basic',
  message: 'Internal service message',
});

describe('product readiness guidance', () => {
  it.each([
    'CATEGORY', 'PRODUCT_TYPE', 'SIZE_SCHEMA', 'VARIANT', 'RENTABLE_SKU', 'VARIANT_MEDIA', 'ACTIVE_PRICING', 'COMPOSITION',
  ] as const)('gives %s a human action and explanation', (code) => {
    const guidance = getProductReadinessGuidance(blocker(code));
    expect(guidance.title).not.toEqual('Internal service message');
    expect(guidance.description).toBeTruthy();
  });

  it('opens an incomplete listing at the required wizard step', () => {
    expect(getProductReadinessFixHref({ productId: 'product-1', blocker: blocker('ACTIVE_PRICING'), needsSetup: true }))
      .toBe('/dashboard/products/new?productId=product-1&issue=ACTIVE_PRICING&step=3');
  });

  it('opens an existing listing at the exact editor tab', () => {
    expect(getProductReadinessFixHref({ productId: 'product-1', blocker: blocker('CATEGORY'), needsSetup: false }))
      .toBe('/dashboard/products/product-1/edit?issue=CATEGORY&focus=basic');
  });
});
