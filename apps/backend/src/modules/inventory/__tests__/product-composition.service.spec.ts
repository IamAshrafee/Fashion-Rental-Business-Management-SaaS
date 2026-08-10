import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CompositionPricingBehavior,
  CompositionSkuResolution,
  CompositionSubstitutionPolicy,
  ProductCompositionRole,
} from '@prisma/client';
import { ProductCompositionService } from '../product-composition.service';

describe('ProductCompositionService', () => {
  const baseRule = {
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
  };

  it('rejects a transitive product composition cycle', async () => {
    const tx = {
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'product-a', status: 'draft' }, { id: 'product-b', status: 'published' }]) },
      productCompositionRule: {
        findMany: jest.fn().mockResolvedValue([
          { parentProductId: 'product-b', componentProductId: 'product-a', alternatives: [] },
        ]),
        create: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ProductCompositionService(prisma as never);

    await expect(service.create('tenant-1', 'product-a', baseRule, 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.productCompositionRule.create).not.toHaveBeenCalled();
  });

  it('requires a published parent to be unpublished before composition edits', async () => {
    const tx = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'product-a', status: 'published' },
          { id: 'product-b', status: 'published' },
        ]),
      },
      productCompositionRule: { findMany: jest.fn(), create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ProductCompositionService(prisma as never);

    await expect(service.create('tenant-1', 'product-a', baseRule)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED' }),
    });
    expect(tx.productCompositionRule.create).not.toHaveBeenCalled();
  });

  it('rejects optional pricing on a required component', async () => {
    const tx = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'product-a', status: 'draft' },
          { id: 'product-b', status: 'published' },
        ]),
      },
      productCompositionRule: { findMany: jest.fn(), create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ProductCompositionService(prisma as never);

    await expect(service.create('tenant-1', 'product-a', {
      ...baseRule,
      pricingBehavior: CompositionPricingBehavior.OPTIONAL_PRICE,
      priceAdjustment: 5_000,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.productCompositionRule.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported compatibility fields instead of pretending to enforce them', async () => {
    const tx = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'product-a', status: 'draft' },
          { id: 'product-b', status: 'published' },
        ]),
      },
      productCompositionRule: { findMany: jest.fn(), create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ProductCompositionService(prisma as never);

    await expect(service.create('tenant-1', 'product-a', {
      ...baseRule,
      compatibilityRules: { sameColor: true },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.productCompositionRule.create).not.toHaveBeenCalled();
  });
});
