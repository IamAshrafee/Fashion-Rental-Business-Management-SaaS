import { BadRequestException } from '@nestjs/common';
import { InventoryTrackingMode, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryAvailabilityService } from '../inventory-availability.service';

describe('InventoryAvailabilityService', () => {
  const prisma = {
    variantSize: { findFirst: jest.fn() },
    storeSettings: { findUnique: jest.fn() },
    dateBlock: { findFirst: jest.fn() },
    inventoryBlock: { findFirst: jest.fn() },
    inventoryReservation: { aggregate: jest.fn() },
    stockUnit: { count: jest.fn() },
  };
  let service: InventoryAvailabilityService;

  const baseSku = {
    id: 'sku-1',
    tenantId: 'tenant-1',
    variantId: 'variant-1',
    sizeInstanceId: 'size-1',
    trackingMode: InventoryTrackingMode.POOLED,
    pooledQuantity: 3,
    variant: {
      product: {
        id: 'product-1',
        status: ProductStatus.published,
        isAvailable: true,
        availableFrom: null,
        deletedAt: null,
      },
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new InventoryAvailabilityService(prisma as unknown as PrismaService);
    prisma.variantSize.findFirst.mockResolvedValue(baseSku);
    prisma.storeSettings.findUnique.mockResolvedValue({ bufferDays: 1 });
    prisma.dateBlock.findFirst.mockResolvedValue(null);
    prisma.inventoryBlock.findFirst.mockResolvedValue(null);
    prisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    prisma.stockUnit.count.mockResolvedValue(0);
  });

  it('subtracts overlapping reservations from pooled capacity and applies buffer days', async () => {
    const result = await service.check({
      tenantId: 'tenant-1',
      productId: 'product-1',
      variantSizeId: 'sku-1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      quantity: 2,
    });

    expect(result).toMatchObject({
      available: true,
      totalCapacity: 3,
      reservedQuantity: 1,
      remainingQuantity: 2,
      effectiveBlockedRange: { start: '2026-08-09', end: '2026-08-13' },
    });
  });

  it('rejects demand above remaining pooled capacity', async () => {
    const result = await service.check({
      tenantId: 'tenant-1',
      productId: 'product-1',
      variantSizeId: 'sku-1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      quantity: 3,
    });

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Requested quantity is not available');
  });

  it('uses eligible active physical units as serialized capacity', async () => {
    prisma.variantSize.findFirst.mockResolvedValue({
      ...baseSku,
      trackingMode: InventoryTrackingMode.SERIALIZED,
      pooledQuantity: 0,
    });
    prisma.stockUnit.count.mockResolvedValue(4);
    prisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });

    const result = await service.check({
      tenantId: 'tenant-1',
      productId: 'product-1',
      variantSizeId: 'sku-1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      quantity: 2,
    });

    expect(prisma.stockUnit.count).toHaveBeenCalled();
    expect(result).toMatchObject({ available: true, totalCapacity: 4, reservedQuantity: 2 });
  });

  it('treats an overlapping scoped block as a hard stop', async () => {
    prisma.inventoryBlock.findFirst.mockResolvedValue({ id: 'block-1' });

    const result = await service.check({
      tenantId: 'tenant-1',
      productId: 'product-1',
      variantSizeId: 'sku-1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
    });

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Inventory is blocked for the selected dates');
    expect(prisma.inventoryReservation.aggregate).not.toHaveBeenCalled();
  });

  it('reports malformed date input as a bad request', () => {
    expect(() => service.parseDate('not-a-date', 'startDate')).toThrow(BadRequestException);
  });
});
