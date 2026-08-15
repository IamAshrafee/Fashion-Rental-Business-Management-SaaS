import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from './product.service';

describe('ProductService optional field clearing', () => {
  const tx = {
    category: { findFirst: jest.fn() },
    productType: { findFirst: jest.fn() },
    sizeSchema: { findFirst: jest.fn() },
    variantSize: { findMany: jest.fn() },
    product: { update: jest.fn() },
    productEvent: { deleteMany: jest.fn(), createMany: jest.fn() },
    productFaq: { deleteMany: jest.fn(), createMany: jest.fn() },
    productDetailHeader: { deleteMany: jest.fn(), create: jest.fn() },
    productDetailEntry: { createMany: jest.fn() },
  };
  const prisma = {
    product: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const service = new ProductService(
    prisma as unknown as PrismaService,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-1',
      tenantId: 'tenant-1',
      deletedAt: null,
      categoryId: 'category-1',
      subcategoryId: 'subcategory-1',
      productTypeId: null,
      sizeSchemaOverrideId: 'schema-1',
      storefrontItemMode: 'INTERNAL_ONLY',
    });
    tx.category.findFirst.mockResolvedValue({ id: 'category-1' });
    tx.variantSize.findMany.mockResolvedValue([]);
    tx.product.update.mockResolvedValue({ id: 'product-1' });
  });

  it('persists explicit nulls when an owner clears optional listing fields', async () => {
    await service.update('tenant-1', 'product-1', {
      subcategoryId: null,
      countryOfOrigin: null,
      referenceRetailValue: null,
      sizeSchemaOverrideId: null,
    });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        subcategoryId: null,
        countryOfOrigin: null,
        referenceRetailValue: null,
        sizeSchemaOverrideId: null,
      },
    });
  });
});
