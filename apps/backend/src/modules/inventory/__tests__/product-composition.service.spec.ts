import { ConflictException } from '@nestjs/common';
import {
  CompositionPricingBehavior,
  CompositionSkuResolution,
  CompositionSubstitutionPolicy,
  ProductCompositionRole,
} from '@prisma/client';
import { ProductCompositionService } from '../product-composition.service';

describe('ProductCompositionService', () => {
  it('rejects a transitive product composition cycle', async () => {
    const tx = {
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'product-a' }, { id: 'product-b' }]) },
      productCompositionRule: {
        findMany: jest.fn().mockResolvedValue([
          { parentProductId: 'product-b', componentProductId: 'product-a', alternatives: [] },
        ]),
        create: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ProductCompositionService(prisma as never);

    await expect(service.create('tenant-1', 'product-a', {
      role: ProductCompositionRole.REQUIRED_COMPONENT,
      name: 'Required accessory',
      componentProductId: 'product-b',
      quantity: 1,
      skuResolution: CompositionSkuResolution.CUSTOMER_SELECTED,
      substitutionPolicy: CompositionSubstitutionPolicy.NOT_ALLOWED,
      pricingBehavior: CompositionPricingBehavior.INCLUDED,
      priceAdjustment: 0,
      allocationWeight: 1,
      isDefaultSelected: false,
      customerApprovalRequired: false,
      displayOrder: 0,
    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.productCompositionRule.create).not.toHaveBeenCalled();
  });
});
