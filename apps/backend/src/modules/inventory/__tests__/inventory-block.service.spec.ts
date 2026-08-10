import { InventoryBlockType } from '@prisma/client';
import { InventoryBlockService } from '../inventory-block.service';

const manualInput = {
  productId: '11111111-1111-4111-8111-111111111111',
  startDate: '2026-08-20',
  endDate: '2026-08-22',
  blockType: InventoryBlockType.MANUAL,
  reason: 'Private collection hold',
};

describe('InventoryBlockService', () => {
  it('previews affected active bookings before a manual block is created', async () => {
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: manualInput.productId, name: 'Red dress' }) },
      inventoryReservation: {
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { quantity: 3 } }),
        findMany: jest.fn().mockResolvedValue([
          { booking: { id: 'booking-1', bookingNumber: 'BK-1001', status: 'confirmed' } },
        ]),
      },
    };
    const service = new InventoryBlockService(prisma as never);

    const result = await service.preview('tenant-1', manualInput);

    expect(result).toMatchObject({ affectedReservations: 2, affectedQuantity: 3 });
    expect(result.warning).toContain('overlaps active rental commitments');
    expect(prisma.inventoryReservation.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 'tenant-1', productId: manualInput.productId }),
      _count: { _all: true },
      _sum: { quantity: true },
    });
  });

  it('rejects operational block creation outside the owning workflow', async () => {
    const service = new InventoryBlockService({} as never);

    await expect(service.preview('tenant-1', {
      ...manualInput,
      stockUnitId: '22222222-2222-4222-8222-222222222222',
      productId: undefined,
      blockType: InventoryBlockType.SERVICE,
    })).rejects.toThrow('Operational blocks must be created by their owning workflow');
  });

  it('prevents generic deletion of a service-owned block', async () => {
    const prisma = {
      inventoryBlock: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'block-1',
          blockType: InventoryBlockType.SERVICE,
          serviceOrder: { id: 'service-1' },
          inspection: null,
          transferLine: null,
        }),
        delete: jest.fn(),
      },
    };
    const service = new InventoryBlockService(prisma as never);

    await expect(service.remove('tenant-1', 'block-1')).rejects.toThrow(
      'Complete or cancel that workflow instead',
    );
    expect(prisma.inventoryBlock.delete).not.toHaveBeenCalled();
  });
});
