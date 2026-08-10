import { InventoryTrackingMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VariantService } from './variant.service';

describe('VariantService catalog safety', () => {
  const countDelegate = () => ({ count: jest.fn().mockResolvedValue(0) });
  const tx = {
    product: { findFirst: jest.fn() },
    productVariant: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    variantColor: { deleteMany: jest.fn(), createMany: jest.fn() },
    variantSize: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    color: { count: jest.fn() },
    sizeInstance: { count: jest.fn() },
    stockUnit: countDelegate(),
    inventoryPool: countDelegate(),
    inventoryReservation: countDelegate(),
    bookingItem: countDelegate(),
    fulfillmentRequirement: countDelegate(),
    inventoryMovement: countDelegate(),
    inventoryBlock: countDelegate(),
    inventoryTransferLine: countDelegate(),
    skuSetComponentDefinition: countDelegate(),
    availabilityPolicy: countDelegate(),
    productCompositionRule: countDelegate(),
    productCompositionAlternative: countDelegate(),
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (callback: (database: typeof tx) => unknown) => callback(tx)),
  };
  const service = new VariantService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (database: typeof tx) => unknown) => callback(tx),
    );
    tx.product.findFirst.mockResolvedValue({
      status: 'draft',
      sizeSchemaOverrideId: 'schema-1',
      productType: { defaultSizeSchemaId: null },
    });
    tx.color.count.mockResolvedValue(1);
    tx.sizeInstance.count.mockResolvedValue(1);
    tx.productVariant.update.mockResolvedValue({ id: 'variant-1' });
    tx.variantColor.deleteMany.mockResolvedValue({ count: 1 });
    tx.variantColor.createMany.mockResolvedValue({ count: 1 });
    tx.variantSize.update.mockResolvedValue({ id: 'sku-1' });
    tx.productVariant.findUniqueOrThrow.mockResolvedValue({ id: 'variant-1' });
    for (const delegate of [
      tx.stockUnit,
      tx.inventoryPool,
      tx.inventoryReservation,
      tx.bookingItem,
      tx.fulfillmentRequirement,
      tx.inventoryMovement,
      tx.inventoryBlock,
      tx.inventoryTransferLine,
      tx.skuSetComponentDefinition,
      tx.availabilityPolicy,
      tx.productCompositionRule,
      tx.productCompositionAlternative,
    ]) {
      delegate.count.mockResolvedValue(0);
    }
  });

  it('requires a published product to be unpublished before adding catalog structure', async () => {
    tx.product.findFirst.mockResolvedValue({
      status: 'published',
      sizeSchemaOverrideId: 'schema-1',
      productType: { defaultSizeSchemaId: null },
    });

    await expect(service.addVariant('tenant-1', 'product-1', {
      mainColorId: 'color-1',
      sizes: [],
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED' }),
    });
    expect(tx.productVariant.create).not.toHaveBeenCalled();
  });

  it('rejects a tracking-mode change once the SKU has operational history', async () => {
    tx.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      tenantId: 'tenant-1',
      mainColorId: 'color-1',
      sizes: [{
        id: 'sku-1',
        sizeInstanceId: 'size-1',
        trackingMode: InventoryTrackingMode.POOLED,
      }],
    });
    tx.stockUnit.count.mockResolvedValue(1);

    await expect(service.updateVariant('tenant-1', 'product-1', 'variant-1', {
      mainColorId: 'color-1',
      sizes: [{ sizeInstanceId: 'size-1', trackingMode: InventoryTrackingMode.SERIALIZED }],
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SKU_HISTORY_CONFLICT', variantSizeId: 'sku-1' }),
    });
    expect(tx.variantSize.update).not.toHaveBeenCalled();
  });

  it('allows a tracking-mode correction for a clean draft SKU', async () => {
    tx.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      tenantId: 'tenant-1',
      mainColorId: 'color-1',
      sizes: [{
        id: 'sku-1',
        sizeInstanceId: 'size-1',
        trackingMode: InventoryTrackingMode.POOLED,
      }],
    });

    await service.updateVariant('tenant-1', 'product-1', 'variant-1', {
      mainColorId: 'color-1',
      sizes: [{ sizeInstanceId: 'size-1', trackingMode: InventoryTrackingMode.SERIALIZED }],
    });

    expect(tx.variantSize.update).toHaveBeenCalledWith({
      where: { id: 'sku-1' },
      data: {
        trackingMode: InventoryTrackingMode.SERIALIZED,
        inventoryVersion: { increment: 1 },
      },
    });
  });
});
