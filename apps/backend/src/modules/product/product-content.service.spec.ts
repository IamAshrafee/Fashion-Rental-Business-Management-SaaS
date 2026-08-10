import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from './product.service';

describe('ProductService content tenant safety', () => {
  const prisma = {
    product: { findFirst: jest.fn() },
    productFaq: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productDetailHeader: { findFirst: jest.fn() },
    productDetailEntry: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new ProductService(
    prisma as unknown as PrismaService,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );

  beforeEach(() => jest.clearAllMocks());

  it('does not create an FAQ unless the tenant owns an active product', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.addFaq('tenant-1', 'foreign-product', {
      question: 'How is it cleaned?',
      answer: 'Professionally.',
    })).rejects.toMatchObject({ status: 404 });

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-product', tenantId: 'tenant-1' },
    });
    expect(prisma.productFaq.create).not.toHaveBeenCalled();
  });

  it('scopes detail-entry deletion through header, product, and tenant', async () => {
    prisma.productDetailEntry.findFirst.mockResolvedValue(null);

    await expect(service.deleteDetailEntry(
      'tenant-1',
      'product-1',
      'header-1',
      'foreign-entry',
    )).rejects.toMatchObject({ status: 404 });

    expect(prisma.productDetailEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'foreign-entry',
        headerId: 'header-1',
        header: {
          productId: 'product-1',
          tenantId: 'tenant-1',
          product: { deletedAt: null },
        },
      },
      select: { id: true },
    });
    expect(prisma.productDetailEntry.delete).not.toHaveBeenCalled();
  });
});
