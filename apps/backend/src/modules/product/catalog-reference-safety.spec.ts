import { PrismaService } from '../../prisma/prisma.service';
import { CategoryService } from './category.service';
import { SizeSchemaService } from '../size-schema/size-schema.service';
import { ProductTypeService } from '../product-type/product-type.service';

describe('Catalog reference safety', () => {
  it('requires published products to move before category deactivation', async () => {
    const prisma = {
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'category-1', isActive: true }) },
      product: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = new CategoryService(prisma as unknown as PrismaService);

    await expect(service.updateCategory('tenant-1', 'category-1', {
      isActive: false,
    })).rejects.toMatchObject({ status: 422 });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        categoryId: 'category-1',
        tenantId: 'tenant-1',
        status: 'published',
        deletedAt: null,
      },
    });
  });

  it('preserves event assignments instead of silently deleting them', async () => {
    const prisma = {
      event: {
        findFirst: jest.fn().mockResolvedValue({ id: 'event-1' }),
        deleteMany: jest.fn(),
      },
      productEvent: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new CategoryService(prisma as unknown as PrismaService);

    await expect(service.deleteEvent('tenant-1', 'event-1')).rejects.toMatchObject({
      status: 422,
    });
    expect(prisma.event.deleteMany).not.toHaveBeenCalled();
  });

  it('does not deprecate a size schema used by published products', async () => {
    const prisma = {
      sizeSchema: {
        findFirst: jest.fn().mockResolvedValue({ id: 'schema-1' }),
        update: jest.fn(),
      },
      product: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new SizeSchemaService(prisma as unknown as PrismaService);

    await expect(service.deprecateSchema('tenant-1', 'schema-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.sizeSchema.update).not.toHaveBeenCalled();
  });

  it('does not change a product type default schema beneath published products', async () => {
    const prisma = {
      productType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          defaultSizeSchemaId: 'schema-old',
        }),
        update: jest.fn(),
      },
      product: { count: jest.fn().mockResolvedValue(1) },
      sizeSchema: { findFirst: jest.fn() },
    };
    const service = new ProductTypeService(prisma as unknown as PrismaService);

    await expect(service.update('tenant-1', 'type-1', {
      defaultSizeSchemaId: 'schema-new',
    })).rejects.toMatchObject({ status: 400 });
    expect(prisma.sizeSchema.findFirst).not.toHaveBeenCalled();
    expect(prisma.productType.update).not.toHaveBeenCalled();
  });
});
