import { InventoryTransferService } from '../inventory-transfer.service';

const tenantId = 'tenant-1';
const originLocationId = '11111111-1111-4111-8111-111111111111';
const destinationLocationId = '22222222-2222-4222-8222-222222222222';
const variantSizeId = '33333333-3333-4333-8333-333333333333';
const actorUserId = '44444444-4444-4444-8444-444444444444';
const stockUnitIds = [
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
];

function setup(eligibleUnitIds = stockUnitIds) {
  const tx = {
    inventoryTransfer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'transfer-1', lines: [] }),
    },
    variantSize: { findFirst: jest.fn().mockResolvedValue({ id: variantSizeId }) },
    stockUnit: {
      findMany: jest.fn().mockResolvedValue(eligibleUnitIds.map((id) => ({ id }))),
    },
    inventoryTransferLine: { create: jest.fn() },
    inventoryTransferEvent: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
  const locations = { getActiveOrThrow: jest.fn().mockResolvedValue({ id: 'location' }) };
  return {
    service: new InventoryTransferService(prisma as never, locations as never, {} as never),
    tx,
  };
}

describe('InventoryTransferService exact physical-item drafts', () => {
  it('persists the selected physical identities as transfer units', async () => {
    const { service, tx } = setup();

    await service.create(
      tenantId,
      {
        originLocationId,
        destinationLocationId,
        lines: [{ variantSizeId, stockUnitIds }],
        idempotencyKey: 'transfer-request-1',
      },
      actorUserId,
    );

    expect(tx.stockUnit.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: stockUnitIds },
        tenantId,
        variantSizeId,
        locationId: originLocationId,
        disposition: 'ACTIVE',
        operationalState: 'AVAILABLE',
      }),
      select: { id: true },
    });
    expect(tx.inventoryTransferLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transferId: 'transfer-1',
        variantSizeId,
        units: {
          create: stockUnitIds.map((stockUnitId) => ({ tenantId, stockUnitId })),
        },
      }),
    });
  });

  it('rejects the entire transfer if one selected identity is not eligible at the origin', async () => {
    const { service, tx } = setup([stockUnitIds[0]]);

    await expect(
      service.create(
        tenantId,
        {
          originLocationId,
          destinationLocationId,
          lines: [{ variantSizeId, stockUnitIds }],
        },
        actorUserId,
      ),
    ).rejects.toThrow('Every physical item must be available at the transfer origin');
    expect(tx.inventoryTransfer.create).not.toHaveBeenCalled();
    expect(tx.inventoryTransferLine.create).not.toHaveBeenCalled();
  });
});
