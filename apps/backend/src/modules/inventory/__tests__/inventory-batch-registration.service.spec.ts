import { InventoryTrackingMode, StockConditionGrade } from '@prisma/client';
import { InventoryManagementService } from '../inventory-management.service';

const request = {
  locationId: 'location-1',
  rows: [
    { assetCode: 'drs-red-m-001' },
    { assetCode: 'drs-red-m-002' },
  ],
  condition: StockConditionGrade.GOOD,
  idempotencyKey: 'a13c0c52-f1d2-41fc-bf26-5a0c8dc7832f',
};

function serviceWith(prisma: object, locations: object = {}) {
  return new InventoryManagementService(prisma as never, {} as never, locations as never);
}

describe('Inventory batch registration', () => {
  it('returns the original atomic batch for a matching retry', async () => {
    const previous: Array<{ id: string; assetCode: string; registrationHash: string }> = [];
    const tx = {
      variantSize: { findFirst: jest.fn().mockResolvedValue({ id: 'sku-1', trackingMode: InventoryTrackingMode.SERIALIZED }) },
      stockUnit: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => {
          const unit = {
            id: `unit-${previous.length + 1}`,
            assetCode: data.assetCode,
            registrationHash: data.registrationHash,
          };
          previous.push(unit);
          return unit;
        }),
      },
      skuSetComponentDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
    };
    const prisma = {
      stockUnit: {
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockImplementation(() => Promise.resolve(previous)),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const locations = { getActiveOrThrow: jest.fn().mockResolvedValue({ id: 'location-1' }) };
    const service = serviceWith(prisma, locations);

    await service.createStockUnitBatch('tenant-1', 'sku-1', request);
    const replay = await service.createStockUnitBatch('tenant-1', 'sku-1', request);

    expect(replay).toMatchObject({ replayed: true, units: previous });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate row identities before creating any unit', async () => {
    const tx = {
      variantSize: { findFirst: jest.fn().mockResolvedValue({ id: 'sku-1', trackingMode: InventoryTrackingMode.SERIALIZED }) },
      stockUnit: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      skuSetComponentDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryMovement: { create: jest.fn() },
    };
    const prisma = {
      stockUnit: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const locations = { getActiveOrThrow: jest.fn().mockResolvedValue({ id: 'location-1' }) };
    const service = serviceWith(prisma, locations);

    await expect(service.createStockUnitBatch('tenant-1', 'sku-1', {
      ...request,
      rows: [{ assetCode: 'same-001' }, { assetCode: 'SAME-001' }],
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BATCH_REGISTRATION_VALIDATION_FAILED' }),
    });
    expect(tx.stockUnit.create).not.toHaveBeenCalled();
  });

  it('creates every row and initializes the SKU set components in one transaction', async () => {
    const tx = {
      variantSize: { findFirst: jest.fn().mockResolvedValue({ id: 'sku-1', trackingMode: InventoryTrackingMode.SERIALIZED }) },
      stockUnit: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'unit-1', assetCode: 'DRS-RED-M-001' })
          .mockResolvedValueOnce({ id: 'unit-2', assetCode: 'DRS-RED-M-002' }),
      },
      skuSetComponentDefinition: {
        findMany: jest.fn().mockResolvedValue([{ id: 'component-1', requiredQuantity: 2 }]),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
    };
    const prisma = {
      stockUnit: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const locations = { getActiveOrThrow: jest.fn().mockResolvedValue({ id: 'location-1' }) };
    const service = serviceWith(prisma, locations);

    const result = await service.createStockUnitBatch('tenant-1', 'sku-1', request, 'user-1');

    expect(result).toMatchObject({ replayed: false, units: [{ id: 'unit-1' }, { id: 'unit-2' }] });
    expect(tx.stockUnit.create).toHaveBeenCalledTimes(2);
    expect(tx.stockUnit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assetCode: 'DRS-RED-M-001',
        registrationKey: request.idempotencyKey,
        registrationRow: 0,
        componentStates: {
          create: [expect.objectContaining({
            setComponentDefinitionId: 'component-1',
            presence: 'PRESENT',
            presentQuantity: 2,
          })],
        },
      }),
    }));
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });
});
