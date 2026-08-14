import {
  InventoryCountIdentityMatch,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { createHash } from 'crypto';
import { InventoryCountService } from '../inventory-count.service';

const actorUserId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const idempotencyKey = '33333333-3333-4333-8333-333333333333';

const unit = (
  id: string,
  assetCode: string,
  currentLocationId = locationId,
  operationalState = StockUnitOperationalState.AVAILABLE,
) => ({
  id,
  assetCode,
  barcode: null,
  variantSizeId: `sku-${id}`,
  locationId: currentLocationId,
  disposition: StockUnitDisposition.ACTIVE,
  operationalState,
});

describe('InventoryCountService', () => {
  it('reconciles expected and observed identities without silently changing item records', async () => {
    const expectedObserved = unit('unit-1', 'DRS-001');
    const missing = unit('unit-2', 'DRS-002');
    const wrongLocation = unit('unit-3', 'DRS-003', 'other-location');
    const sessionDetail = { id: 'count-1', items: [], observations: [] };
    const tx = {
      inventoryCountSession: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'count-1' }),
        findFirst: jest.fn().mockResolvedValue(sessionDetail),
      },
      inventoryLocation: { findFirst: jest.fn().mockResolvedValue({ id: locationId }) },
      stockUnit: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([expectedObserved, wrongLocation])
          .mockResolvedValueOnce([expectedObserved, missing]),
      },
      inventoryCountObservation: { createMany: jest.fn() },
      inventoryCountItem: { createMany: jest.fn() },
      inventoryMovement: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryCountService(prisma as never);

    const result = await service.reconcile(
      'tenant-1',
      {
        locationId,
        identities: ['DRS-001', 'DRS-001', 'DRS-003', 'UNKNOWN-01'],
        reason: 'Monthly warehouse count',
        idempotencyKey,
      },
      actorUserId,
    );

    expect(result).toEqual({ replayed: false, session: sessionDetail });
    expect(tx.inventoryCountSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expectedCount: 2,
        observedUniqueCount: 2,
        missingCount: 1,
        unexpectedCount: 1,
        duplicateScanCount: 1,
        unknownScanCount: 1,
        wrongLocationCount: 1,
      }),
    });
    expect(tx.inventoryCountObservation.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          scannedIdentity: 'DRS-001',
          identityMatch: InventoryCountIdentityMatch.ASSET_CODE,
          isDuplicate: true,
        }),
        expect.objectContaining({
          scannedIdentity: 'UNKNOWN-01',
          identityMatch: InventoryCountIdentityMatch.UNKNOWN,
        }),
      ]),
    });
    expect(tx.inventoryCountItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ stockUnitId: 'unit-2', missing: true, observed: false }),
        expect.objectContaining({
          stockUnitId: 'unit-3',
          unexpected: true,
          wrongLocation: true,
        }),
      ]),
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect((tx as Record<string, unknown>).stockUnit).toBeDefined();
    expect((tx.stockUnit as { update?: unknown }).update).toBeUndefined();
  });

  it('replays the same idempotent count without creating new observations or movements', async () => {
    const sessionDetail = { id: 'count-existing', items: [], observations: [] };
    const dto = {
      locationId,
      identities: ['DRS-001'],
      reason: 'Monthly warehouse count',
      idempotencyKey,
    };
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          locationId,
          identities: dto.identities,
          reason: dto.reason,
          notes: null,
        }),
      )
      .digest('hex');
    const tx = {
      inventoryCountSession: {
        findUnique: jest.fn().mockResolvedValue({ id: 'count-existing', requestHash }),
        findFirst: jest.fn().mockResolvedValue(sessionDetail),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryCountService(prisma as never);

    await expect(service.reconcile('tenant-1', dto, actorUserId)).resolves.toEqual({
      replayed: true,
      session: sessionDetail,
    });
    expect(tx.inventoryCountSession.findFirst).toHaveBeenCalled();
  });

  it('rejects an identity that matches one item asset code and another item barcode', async () => {
    const assetMatch = unit('unit-1', 'DRS-001');
    const barcodeMatch = { ...unit('unit-2', 'OTHER-002'), barcode: 'DRS-001' };
    const tx = {
      inventoryCountSession: { findUnique: jest.fn().mockResolvedValue(null) },
      inventoryLocation: { findFirst: jest.fn().mockResolvedValue({ id: locationId }) },
      stockUnit: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([assetMatch, barcodeMatch])
          .mockResolvedValueOnce([]),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryCountService(prisma as never);

    await expect(
      service.reconcile(
        'tenant-1',
        {
          locationId,
          identities: ['DRS-001'],
          reason: 'Opening count',
          idempotencyKey,
        },
        actorUserId,
      ),
    ).rejects.toThrow('ambiguously matches');
  });
});
