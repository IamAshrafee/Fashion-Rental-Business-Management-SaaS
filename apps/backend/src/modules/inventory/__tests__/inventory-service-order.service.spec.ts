import { ConflictException } from '@nestjs/common';
import {
  InventoryServiceOrderStatus,
  InventoryServiceOrderType,
} from '@prisma/client';
import { InventoryServiceOrderService } from '../inventory-service-order.service';

describe('InventoryServiceOrderService', () => {
  it('filters the global service queue by provider, product, location, and overdue state', async () => {
    const prisma = {
      inventoryServiceOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new InventoryServiceOrderService(prisma as never, {} as never, {} as never);

    await service.listQueue('tenant-1', {
      page: 1, limit: 25, serviceType: 'REPAIR', overdue: 'true', provider: 'Tailor',
      productId: 'product-1', locationId: 'location-1',
    } as never);

    expect(prisma.inventoryServiceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1', serviceType: 'REPAIR', serviceLocationId: 'location-1',
          providerName: { contains: 'Tailor', mode: 'insensitive' },
          status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] },
          stockUnit: expect.objectContaining({ deletedAt: null }),
        }),
      }),
    );
  });
  it('requires a completion inspection after repair work', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'service-1' }]),
      inventoryServiceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'service-1',
          tenantId: 'tenant-1',
          stockUnitId: 'unit-1',
          serviceType: InventoryServiceOrderType.REPAIR,
          status: InventoryServiceOrderStatus.IN_PROGRESS,
          inventoryBlockId: 'block-1',
          cost: null,
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const lifecycle = { transitionInTransaction: jest.fn() };
    const service = new InventoryServiceOrderService(prisma as never, lifecycle as never, {} as never);

    await expect(
      service.complete(
        'tenant-1',
        'service-1',
        {
          completionOutcome: 'Repair finished',
          requiresInspection: false,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(lifecycle.transitionInTransaction).not.toHaveBeenCalled();
  });

  it('cancels started work, removes its block, reopens its issue, and requires inspection', async () => {
    const order = {
      id: 'service-1',
      tenantId: 'tenant-1',
      stockUnitId: 'unit-1',
      issueId: 'issue-1',
      serviceType: InventoryServiceOrderType.CLEANING,
      status: InventoryServiceOrderStatus.IN_PROGRESS,
      inventoryBlockId: 'block-1',
      notes: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'service-1' }]),
      inventoryServiceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({ ...order, status: InventoryServiceOrderStatus.CANCELLED }),
      },
      inventoryBlock: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      stockUnitIssue: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const lifecycle = { transitionInTransaction: jest.fn().mockResolvedValue({}) };
    const service = new InventoryServiceOrderService(prisma as never, lifecycle as never, {} as never);

    await service.cancel(
      'tenant-1',
      'service-1',
      { reason: 'Provider unavailable', idempotencyKey: 'cancel-1' },
      'user-1',
    );

    expect(tx.inventoryBlock.deleteMany).toHaveBeenCalledWith({
      where: { id: 'block-1', tenantId: 'tenant-1' },
    });
    expect(tx.stockUnitIssue.updateMany).toHaveBeenCalled();
    expect(lifecycle.transitionInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        targetOperationalState: 'AWAITING_INSPECTION',
        serviceOrderId: 'service-1',
      }),
    );
  });
});
