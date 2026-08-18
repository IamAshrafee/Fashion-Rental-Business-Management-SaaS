import {
  StockConditionGrade,
  StockUnitComponentPresence,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { InventoryManagementService } from '../inventory-management.service';

const tenantId = 'tenant-1';
const variantSizeId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '33333333-3333-4333-8333-333333333333';
const idempotencyKey = '44444444-4444-4444-8444-444444444444';

function makeService(tx: Record<string, unknown>) {
  const prisma = {
    stockUnit: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const locations = { getActiveOrThrow: jest.fn().mockResolvedValue({ id: locationId }) };
  const custodies = { initializeBusinessLocation: jest.fn() };
  return {
    service: new InventoryManagementService(
      prisma as never,
      {} as never,
      locations as never,
      custodies as never,
    ),
    prisma,
    locations,
    custodies,
  };
}

describe('InventoryManagementService serialized registration and correction', () => {
  it('registers every batch row as a distinct physical item with inherited acquisition data', async () => {
    const tx = {
      variantSize: {
        findFirst: jest.fn().mockResolvedValue({
          id: variantSizeId,
          sizeInstance: {},
          variant: { productId: 'product-1' },
        }),
      },
      stockUnit: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `unit-${data.registrationRow + 1}`,
            createdAt: new Date('2026-08-18T00:00:00.000Z'),
            ...data,
          }),
        ),
      },
      skuSetComponentDefinition: {
        findMany: jest.fn().mockResolvedValue([{ id: 'component-1', requiredQuantity: 1 }]),
      },
      inventoryMovement: { create: jest.fn() },
    };
    const { service, custodies } = makeService(tx);

    const result = await service.createStockUnitBatch(
      tenantId,
      variantSizeId,
      {
        locationId,
        rows: [
          { assetCode: ' drs-001 ' },
          { assetCode: 'DRS-002', acquisitionCost: 21000, condition: StockConditionGrade.FAIR },
        ],
        acquisitionDate: '2026-08-01',
        acquisitionCost: 18000,
        acquisitionSource: 'Designer invoice',
        componentStates: [
          { definitionId: 'component-1', presence: StockUnitComponentPresence.PRESENT },
        ],
        idempotencyKey,
      },
      actorUserId,
    );

    expect(result.replayed).toBe(false);
    expect(result.units).toHaveLength(2);
    expect(tx.stockUnit.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          assetCode: 'DRS-001',
          acquisitionCost: 18000,
          registrationRow: 0,
          componentStates: {
            create: [expect.objectContaining({ setComponentDefinitionId: 'component-1' })],
          },
        }),
      }),
    );
    expect(tx.stockUnit.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          assetCode: 'DRS-002',
          acquisitionCost: 21000,
          condition: StockConditionGrade.FAIR,
          registrationRow: 1,
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(custodies.initializeBusinessLocation).toHaveBeenCalledTimes(2);
    expect(custodies.initializeBusinessLocation).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        stockUnitId: 'unit-1',
        locationId,
        idempotencyKey: `registration:${idempotencyKey}:0`,
      }),
    );
  });

  it('rejects duplicate identities before any physical item is created', async () => {
    const tx = {
      variantSize: {
        findFirst: jest.fn().mockResolvedValue({
          id: variantSizeId,
          sizeInstance: {},
          variant: { productId: 'product-1' },
        }),
      },
      stockUnit: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      skuSetComponentDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryMovement: { create: jest.fn() },
    };
    const { service } = makeService(tx);

    await expect(
      service.createStockUnitBatch(
        tenantId,
        variantSizeId,
        {
          locationId,
          rows: [{ assetCode: 'DRS-001' }, { assetCode: ' drs-001 ' }],
          idempotencyKey,
        },
        actorUserId,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BATCH_REGISTRATION_VALIDATION_FAILED',
        errors: [expect.objectContaining({ row: 1, field: 'assetCode' })],
      }),
    });
    expect(tx.stockUnit.create).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('uses optimistic concurrency and records acquisition metadata corrections', async () => {
    const before = {
      id: 'unit-1',
      tenantId,
      variantSizeId,
      assetCode: 'DRS-001',
      barcode: null,
      acquisitionDate: new Date('2026-08-01'),
      acquisitionCost: 18000,
      acquisitionSource: null,
      acquisitionReference: null,
      notes: null,
      estimatedCurrentValue: null,
      condition: StockConditionGrade.GOOD,
      disposition: StockUnitDisposition.ACTIVE,
      operationalState: StockUnitOperationalState.AVAILABLE,
      version: 3,
    };
    const after = {
      ...before,
      acquisitionCost: 19000,
      acquisitionReference: 'INV-204',
      version: 4,
    };
    const tx = {
      stockUnit: {
        findFirst: jest.fn().mockResolvedValue(before),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(after),
      },
      inventoryMovement: { create: jest.fn() },
    };
    const { service } = makeService(tx);

    await service.updateStockUnit(
      tenantId,
      before.id,
      {
        expectedVersion: 3,
        acquisitionCost: 19000,
        acquisitionReference: 'INV-204',
        reason: 'Corrected from supplier invoice',
      },
      actorUserId,
    );

    expect(tx.stockUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: before.id, tenantId, version: 3 }),
        data: expect.objectContaining({ version: { increment: 1 }, acquisitionCost: 19000 }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockUnitId: before.id,
        movementType: 'ADMIN_CORRECTION',
        reason: 'Corrected from supplier invoice',
        beforeState: expect.objectContaining({ acquisitionCost: 18000 }),
        afterState: expect.objectContaining({ acquisitionCost: 19000 }),
      }),
    });
  });
});
