import { ProductStatus, StockConditionGrade, StockUnitOperationalState } from '@prisma/client';
import { InventoryAvailabilityService } from '../inventory-availability.service';

describe('InventoryAvailabilityService physical-item capacity', () => {
  it('subtracts reservation demand once and does not subtract exact assignments again', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-15T00:00:00Z').getTime());
    const prisma = {
      variantSize: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sku-1',
          variantId: 'variant-1',
          sizeInstanceId: 'size-1',
          variant: {
            product: {
              id: 'product-1',
              status: ProductStatus.published,
              isAvailable: true,
              availableFrom: null,
              deletedAt: null,
            },
          },
        }),
      },
      inventoryLocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'location-1',
            code: 'MAIN',
            name: 'Main warehouse',
            timezone: 'Asia/Dhaka',
            isDefault: true,
          },
        ]),
      },
      inventoryBlock: { findFirst: jest.fn().mockResolvedValue(null) },
      stockUnit: { count: jest.fn().mockResolvedValue(3) },
      inventoryReservation: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
      },
    };
    const policy = {
      preparationBufferMinutes: 0,
      deliveryBufferMinutes: 0,
      returnBufferMinutes: 0,
      inspectionBufferMinutes: 0,
      cleaningBufferMinutes: 0,
      minimumNoticeMinutes: 0,
      maximumAdvanceDays: 365,
      allowShortage: false,
      shortageLimit: 0,
      eligibleOperationalStates: [StockUnitOperationalState.AVAILABLE],
      eligibleConditionGrades: [StockConditionGrade.NEW, StockConditionGrade.GOOD],
    };
    const policies = {
      resolve: jest.fn().mockResolvedValue(policy),
      calculateBlockedRange: jest.fn((start, end) => ({ blockedStart: start, blockedEnd: end })),
    };
    const service = new InventoryAvailabilityService(prisma as never, policies as never);

    const result = await service.check({
      tenantId: 'tenant-1',
      productId: 'product-1',
      variantSizeId: 'sku-1',
      sourceLocationId: 'location-1',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      quantity: 2,
    });

    expect(result).toMatchObject({
      totalCapacity: 3,
      reservedQuantity: 1,
      remainingQuantity: 2,
      available: true,
    });
    expect(prisma.stockUnit.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        variantSizeId: 'sku-1',
        locationId: 'location-1',
        disposition: 'ACTIVE',
      }),
    });
    const capacityWhere = prisma.stockUnit.count.mock.calls[0][0].where;
    expect(capacityWhere).not.toHaveProperty('assignments');
    now.mockRestore();
  });
});
