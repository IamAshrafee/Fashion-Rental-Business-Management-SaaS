import {
  AvailabilityPolicyScope,
  InventoryLocationType,
  InventoryTrackingMode,
} from '@prisma/client';
import { AvailabilityPolicyService } from '../availability-policy.service';
import { InventoryLocationService } from '../inventory-location.service';
import { InventoryPoolService } from '../inventory-pool.service';

const emptyPolicyFields = {
  preparationBufferMinutes: null,
  deliveryBufferMinutes: null,
  returnBufferMinutes: null,
  inspectionBufferMinutes: null,
  cleaningBufferMinutes: null,
  minimumNoticeMinutes: null,
  maximumAdvanceDays: null,
  pendingHoldMinutes: null,
  allowShortage: null,
  shortageLimit: null,
  requireSingleLocationForBundle: null,
  allowCrossLocationTransfers: null,
  transferLeadTimeMinutes: null,
  eligibleConditionGrades: null,
  eligibleOperationalStates: null,
};

describe('Inventory foundation services', () => {
  it('makes the first inventory location the tenant default', async () => {
    const tx = {
      inventoryLocation: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'location-1', ...data })),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryLocationService(prisma as never);

    const result = await service.create('tenant-1', {
      code: 'MAIN',
      name: 'Main Warehouse',
      locationType: InventoryLocationType.WAREHOUSE,
    }, 'user-1');

    expect(result).toMatchObject({ isDefault: true, code: 'MAIN' });
    expect(tx.inventoryLocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        isDefault: true,
        canStoreInventory: true,
        canFulfillRentals: true,
      }),
    });
  });

  it('resolves tenant, product, location, and SKU policy layers deterministically', async () => {
    const policies = [
      {
        id: 'tenant-policy',
        scope: AvailabilityPolicyScope.TENANT,
        version: 1,
        ...emptyPolicyFields,
        pendingHoldMinutes: 45,
        preparationBufferMinutes: 720,
      },
      {
        id: 'product-policy',
        scope: AvailabilityPolicyScope.PRODUCT,
        version: 2,
        ...emptyPolicyFields,
        cleaningBufferMinutes: 1_440,
      },
      {
        id: 'location-policy',
        scope: AvailabilityPolicyScope.LOCATION,
        version: 3,
        ...emptyPolicyFields,
        preparationBufferMinutes: 1_440,
      },
      {
        id: 'sku-policy',
        scope: AvailabilityPolicyScope.SKU,
        version: 4,
        ...emptyPolicyFields,
        pendingHoldMinutes: 20,
      },
    ];
    const prisma = { availabilityPolicy: { findMany: jest.fn().mockResolvedValue(policies) } };
    const service = new AvailabilityPolicyService(prisma as never);

    const result = await service.resolve(
      prisma as never,
      'tenant-1',
      'product-1',
      'sku-1',
      'location-1',
    );

    expect(result).toMatchObject({
      preparationBufferMinutes: 1_440,
      cleaningBufferMinutes: 1_440,
      pendingHoldMinutes: 20,
    });
    expect(result.sources.map((source) => source.scope)).toEqual([
      'TENANT',
      'PRODUCT',
      'LOCATION',
      'SKU',
    ]);
  });

  it('records an auditable movement when pooled on-hand quantity changes', async () => {
    const tx = {
      variantSize: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sku-1',
          trackingMode: InventoryTrackingMode.POOLED,
        }),
      },
      inventoryPool: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'pool-1',
          variantSizeId: 'sku-1',
          locationId: 'location-1',
          onHandQuantity: 5,
        }),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const locations = { getActiveOrThrow: jest.fn().mockResolvedValue({ id: 'location-1' }) };
    const service = new InventoryPoolService(prisma as never, locations as never);

    await service.setQuantity('tenant-1', 'sku-1', {
      locationId: 'location-1',
      onHandQuantity: 5,
      reason: 'Opening stock count',
    }, 'user-1');

    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryPoolId: 'pool-1',
        destinationLocationId: 'location-1',
        movementType: 'POOLED_ADDITION',
        quantityDelta: 5,
        reason: 'Opening stock count',
      }),
    });
  });
});
