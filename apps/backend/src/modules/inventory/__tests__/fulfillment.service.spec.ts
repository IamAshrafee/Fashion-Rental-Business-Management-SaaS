import {
  CompositionPricingBehavior,
  CompositionSkuResolution,
  CompositionSubstitutionPolicy,
  FulfillmentEventType,
  FulfillmentPreparationStatus,
  FulfillmentRequirementStatus,
  InventoryTrackingMode,
  ProductCompositionRole,
} from '@prisma/client';
import { createHash } from 'crypto';
import { FulfillmentService } from '../fulfillment.service';

function sku(id: string, productId: string, productName: string, size = 'M') {
  return {
    id,
    sizeInstance: { id: `size-${id}`, displayLabel: size, normalizedKey: size.toLowerCase() },
    variant: {
      id: `variant-${id}`,
      variantName: 'Red',
      mainColor: { id: 'red', name: 'Red', hexCode: '#f00' },
      product: { id: productId, name: productName, deletedAt: null },
    },
  };
}

describe('FulfillmentService', () => {
  const availability = { check: jest.fn() };
  const reservations = { lockVariantSizes: jest.fn(), create: jest.fn() };
  const lifecycle = { transitionInTransaction: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('expands a fixed assembled component into a separate flat requirement', async () => {
    const mainSku = sku('sku-main', 'product-main', 'Wedding package');
    const componentSku = sku('sku-shoe', 'product-shoe', 'Wedding shoes', '40');
    const rule = {
      id: 'rule-shoes',
      componentProductId: 'product-shoe',
      fixedVariantSizeId: 'sku-shoe',
      role: ProductCompositionRole.REQUIRED_COMPONENT,
      name: 'Shoes',
      quantity: 1,
      skuResolution: CompositionSkuResolution.FIXED,
      substitutionPolicy: CompositionSubstitutionPolicy.EQUIVALENT_ONLY,
      pricingBehavior: CompositionPricingBehavior.INCLUDED,
      priceAdjustment: 0,
      allocationWeight: 1,
      customerApprovalRequired: false,
      compatibilityRules: null,
      configurationVersion: 2,
      isDefaultSelected: false,
      componentProduct: { id: 'product-shoe', name: 'Wedding shoes' },
      fixedVariantSize: componentSku,
      alternatives: [],
    };
    const tx = {
      variantSize: {
        findFirstOrThrow: jest.fn()
          .mockResolvedValueOnce(mainSku)
          .mockResolvedValueOnce(componentSku),
      },
      productCompositionRule: { findMany: jest.fn().mockResolvedValueOnce([rule]).mockResolvedValueOnce([]) },
    };
    const service = new FulfillmentService({} as never, availability as never, reservations as never, lifecycle as never);

    const proposals = await service.expandProposal(tx as never, {
      tenantId: 'tenant-1',
      productId: 'product-main',
      variantSizeId: 'sku-main',
      quantity: 2,
    });

    expect(proposals).toHaveLength(2);
    expect(proposals[1]).toMatchObject({
      role: ProductCompositionRole.REQUIRED_COMPONENT,
      productId: 'product-shoe',
      variantSizeId: 'sku-shoe',
      quantity: 2,
      parentRequirementKey: 'MAIN',
    });
  });

  it('records a partial pooled return without completing the requirement', async () => {
    const requirement = {
      id: 'req-1',
      tenantId: 'tenant-1',
      quantity: 2,
      assignedQuantity: 0,
      handedOutQuantity: 2,
      returnedQuantity: 0,
      lostQuantity: 0,
      status: FulfillmentRequirementStatus.HANDED_OUT,
      preparationStatus: FulfillmentPreparationStatus.READY,
      booking: { status: 'delivered' },
      variantSize: { trackingMode: InventoryTrackingMode.POOLED },
      reservation: { id: 'reservation-1' },
    };
    const tx = {
      $queryRaw: jest.fn(),
      fulfillmentRequirement: {
        findFirst: jest.fn().mockResolvedValue(requirement),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...requirement, returnedQuantity: 1 }),
      },
      fulfillmentRequirementEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      stockUnitAssignment: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new FulfillmentService(prisma as never, availability as never, reservations as never, lifecycle as never);

    await service.recordEvent('tenant-1', 'req-1', {
      eventType: FulfillmentEventType.RETURNED,
      quantity: 1,
      reason: 'First piece returned',
      idempotencyKey: 'return-1',
    }, 'user-1');

    expect(tx.fulfillmentRequirement.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        returnedQuantity: 1,
        status: FulfillmentRequirementStatus.PARTIALLY_RETURNED,
      }),
    });
    expect(tx.fulfillmentRequirementEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: FulfillmentEventType.RETURNED,
        toStatus: FulfillmentRequirementStatus.PARTIALLY_RETURNED,
      }),
    });
  });

  it('records preparation readiness as an idempotent audited fact', async () => {
    const requirement = {
      id: 'req-1',
      tenantId: 'tenant-1',
      productNameSnapshot: 'Red dress',
      quantity: 1,
      assignedQuantity: 1,
      handedOutQuantity: 0,
      status: FulfillmentRequirementStatus.ASSIGNED,
      preparationStatus: FulfillmentPreparationStatus.IN_PROGRESS,
      booking: { status: 'confirmed' },
      variantSize: { trackingMode: InventoryTrackingMode.SERIALIZED },
      reservation: { id: 'reservation-1' },
    };
    const updated = { ...requirement, preparationStatus: FulfillmentPreparationStatus.READY };
    const preparationRequestHash = createHash('sha256').update(JSON.stringify({
      requirementId: 'req-1',
      preparationStatus: FulfillmentPreparationStatus.READY,
      reason: 'Cleaned, checked, and packed',
    })).digest('hex');
    const tx = {
      $queryRaw: jest.fn(),
      fulfillmentRequirement: {
        findFirst: jest.fn().mockResolvedValue(requirement),
        update: jest.fn().mockResolvedValue(updated),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      fulfillmentRequirementEvent: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          requirementId: 'req-1',
          eventType: FulfillmentEventType.PREPARATION_COMPLETED,
          metadata: { requestHash: preparationRequestHash },
        }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new FulfillmentService(prisma as never, availability as never, reservations as never, lifecycle as never);

    const payload = {
      preparationStatus: 'READY' as const,
      reason: 'Cleaned, checked, and packed',
      idempotencyKey: 'prepare-ready-1',
    };
    await service.prepareRequirement('tenant-1', 'req-1', payload, 'user-1');
    await service.prepareRequirement('tenant-1', 'req-1', payload, 'user-1');

    expect(tx.fulfillmentRequirement.update).toHaveBeenCalledTimes(1);
    expect(tx.fulfillmentRequirementEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.fulfillmentRequirementEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: FulfillmentEventType.PREPARATION_COMPLETED,
        idempotencyKey: 'prepare-ready-1',
        actorUserId: 'user-1',
      }),
    });
  });

  it('writes off pooled on-hand inventory when an active rental piece is lost', async () => {
    const requirement = {
      id: 'req-loss',
      tenantId: 'tenant-1',
      bookingItemId: 'item-1',
      sourceLocationId: 'location-1',
      variantSizeId: 'sku-1',
      quantity: 2,
      assignedQuantity: 0,
      handedOutQuantity: 2,
      returnedQuantity: 0,
      lostQuantity: 0,
      status: FulfillmentRequirementStatus.HANDED_OUT,
      preparationStatus: FulfillmentPreparationStatus.READY,
      booking: { status: 'delivered' },
      variantSize: { trackingMode: InventoryTrackingMode.POOLED },
      reservation: { id: 'reservation-1', inventoryPoolId: 'pool-1' },
    };
    const tx = {
      $queryRaw: jest.fn(),
      fulfillmentRequirement: {
        findFirst: jest.fn().mockResolvedValue(requirement),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...requirement, lostQuantity: 1 }),
      },
      fulfillmentRequirementEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      inventoryPool: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pool-1', onHandQuantity: 5, version: 2 }),
        update: jest.fn().mockResolvedValue({ id: 'pool-1', onHandQuantity: 4, version: 3 }),
      },
      inventoryMovement: { create: jest.fn() },
      stockUnitAssignment: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new FulfillmentService(prisma as never, availability as never, reservations as never, lifecycle as never);

    await service.recordEvent('tenant-1', 'req-loss', {
      eventType: FulfillmentEventType.MARKED_LOST,
      quantity: 1,
      reason: 'Customer reported one pooled accessory missing',
      idempotencyKey: 'loss-1',
    }, 'user-1');

    expect(tx.inventoryPool.update).toHaveBeenCalledWith({
      where: { id: 'pool-1' },
      data: { onHandQuantity: { decrement: 1 }, version: { increment: 1 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryPoolId: 'pool-1',
        quantityDelta: -1,
        reservationId: 'reservation-1',
      }),
    });
  });

  it('does not mark serialized preparation ready until every asset is assigned', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      fulfillmentRequirement: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'req-1',
          quantity: 2,
          assignedQuantity: 1,
          handedOutQuantity: 0,
          status: FulfillmentRequirementStatus.PARTIALLY_ASSIGNED,
          preparationStatus: FulfillmentPreparationStatus.IN_PROGRESS,
          booking: { status: 'confirmed' },
          variantSize: { trackingMode: InventoryTrackingMode.SERIALIZED },
          reservation: { id: 'reservation-1' },
        }),
        update: jest.fn(),
      },
      fulfillmentRequirementEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new FulfillmentService(prisma as never, availability as never, reservations as never, lifecycle as never);

    await expect(service.prepareRequirement('tenant-1', 'req-1', {
      preparationStatus: 'READY',
      reason: 'Attempted early readiness',
      idempotencyKey: 'prepare-ready-early',
    }, 'user-1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ASSIGNMENT_REQUIRED' }) });

    expect(tx.fulfillmentRequirement.update).not.toHaveBeenCalled();
    expect(tx.fulfillmentRequirementEvent.create).not.toHaveBeenCalled();
  });

  it('plans every bundle requirement from one common location when capacity exists', async () => {
    const tx = {
      inventoryLocation: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'location-1', isDefault: true },
          { id: 'location-2', isDefault: false },
        ]),
      },
    };
    availability.check.mockImplementation(({ sourceLocationId, variantSizeId }) => ({
      available: sourceLocationId === 'location-1',
      sourceLocationId,
      variantSizeId,
      remainingQuantity: 3,
      availabilityPolicy: { requireSingleLocationForBundle: true },
    }));
    const service = new FulfillmentService(
      {} as never,
      availability as never,
      reservations as never,
      lifecycle as never,
    );
    const proposals = [
      {
        requirementKey: 'MAIN',
        role: ProductCompositionRole.MAIN,
        selectionSource: 'MAIN_PRODUCT',
        productId: 'product-main',
        variantSizeId: 'sku-main',
        quantity: 1,
        productName: 'Main',
        variantName: null,
        sizeLabel: 'M',
        priceAdjustment: 0,
      },
      {
        requirementKey: 'MAIN/RULE:shoe',
        role: ProductCompositionRole.REQUIRED_COMPONENT,
        selectionSource: 'FIXED_RULE',
        productId: 'product-shoe',
        variantSizeId: 'sku-shoe',
        quantity: 1,
        productName: 'Shoes',
        variantName: null,
        sizeLabel: '40',
        priceAdjustment: 0,
      },
    ];

    const plan = await (service as unknown as {
      planRequirementAvailability: (
        transaction: unknown,
        input: Record<string, unknown>,
      ) => Promise<Map<string, { sourceLocationId: string }>>;
    }).planRequirementAvailability(tx, {
      tenantId: 'tenant-1',
      bookingId: 'booking-1',
      bookingItemId: 'item-1',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      reservationStatus: 'PENDING',
      proposals,
      itemRevenue: 1000,
    });

    expect(plan.get('MAIN')?.sourceLocationId).toBe('location-1');
    expect(plan.get('MAIN/RULE:shoe')?.sourceLocationId).toBe('location-1');
  });

  it('leaves every requirement unchanged when one component cannot extend', async () => {
    const requirements = ['main', 'component'].map((id) => ({
      id,
      productId: `product-${id}`,
      variantSizeId: `sku-${id}`,
      sourceLocationId: 'location-1',
      productNameSnapshot: id,
      quantity: 1,
      assignedQuantity: 0,
      handedOutQuantity: 0,
      returnedQuantity: 0,
      lostQuantity: 0,
      currentVersion: 1,
      status: FulfillmentRequirementStatus.RESERVED,
      selectionSource: 'FIXED_RULE',
      rentalStartDate: new Date('2026-08-10'),
      rentalEndDate: new Date('2026-08-12'),
      blockedStartDate: new Date('2026-08-09'),
      blockedEndDate: new Date('2026-08-13'),
      reservation: { id: `reservation-${id}` },
    }));
    const tx = {
      $queryRaw: jest.fn(),
      fulfillmentExtension: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1', status: 'confirmed', grandTotal: 10_000, totalPaid: 0,
          items: [{ id: 'item-1', baseRental: 5_000, endDate: new Date('2026-08-12') }],
        }),
        update: jest.fn(),
      },
      bookingItem: { update: jest.fn() },
      fulfillmentRequirement: {
        findMany: jest.fn().mockResolvedValue(requirements),
        update: jest.fn(),
      },
      inventoryReservation: { update: jest.fn() },
      fulfillmentRequirementVersion: { create: jest.fn() },
      fulfillmentRequirementEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    availability.check
      .mockResolvedValueOnce({
        available: true,
        availabilityPolicy: { sources: [] },
        rentalRange: { start: '2026-08-10', end: '2026-08-15' },
        effectiveBlockedRange: { start: '2026-08-09', end: '2026-08-16' },
      })
      .mockResolvedValueOnce({
        available: false,
        reason: 'Component has a later commitment',
        rentalRange: { start: '2026-08-10', end: '2026-08-15' },
        effectiveBlockedRange: { start: '2026-08-09', end: '2026-08-16' },
      });
    const service = new FulfillmentService(prisma as never, availability as never, reservations as never, lifecycle as never);

    await expect(service.extendBookingRequirements('tenant-1', 'booking-1', {
      rentalEndDate: '2026-08-15',
      reason: 'Customer requested an extension',
      extensionCharge: 1_000,
      approvalEvidence: 'Customer message reference',
      idempotencyKey: 'extension-1',
    }, 'user-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RENTAL_EXTENSION_CONFLICT' }),
    });

    expect(tx.inventoryReservation.update).not.toHaveBeenCalled();
    expect(tx.fulfillmentRequirement.update).not.toHaveBeenCalled();
    expect(tx.fulfillmentRequirementVersion.create).not.toHaveBeenCalled();
  });

  it('blocks booking inspection while a returned physical item still awaits its return inspection', async () => {
    const tx = {
      fulfillmentRequirement: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 1, returnedQuantity: 1, lostQuantity: 0 },
        ]),
      },
      stockUnitAssignment: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new FulfillmentService(
      {} as never,
      availability as never,
      reservations as never,
      lifecycle as never,
    );

    await expect(
      service.assertAndTransitionBooking(
        tx as never,
        'tenant-1',
        'booking-1',
        'inspected',
      ),
    ).rejects.toThrow('Complete the return inspection for every returned physical item first');

    expect(tx.stockUnitAssignment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        reservation: { bookingId: 'booking-1' },
        releasedAt: { not: null },
      }),
    });
  });

  it('allows booking inspection after every returned physical item has been inspected', async () => {
    const tx = {
      fulfillmentRequirement: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 2, returnedQuantity: 1, lostQuantity: 1 },
        ]),
      },
      stockUnitAssignment: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new FulfillmentService(
      {} as never,
      availability as never,
      reservations as never,
      lifecycle as never,
    );

    await expect(
      service.assertAndTransitionBooking(
        tx as never,
        'tenant-1',
        'booking-1',
        'inspected',
      ),
    ).resolves.toBeUndefined();
  });
});
