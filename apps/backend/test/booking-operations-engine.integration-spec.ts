import { Prisma, PrismaClient } from '@prisma/client';
import { BookingVersionService } from '../src/modules/operations/booking-version.service';
import { OperationalEventService } from '../src/modules/operations/operational-event.service';
import { OperationsQueryService } from '../src/modules/operations/operations-query.service';
import { BookingReviewService } from '../src/modules/operations/booking-review.service';
import { StockUnitLifecycleService } from '../src/modules/inventory/stock-unit-lifecycle.service';
import { StockUnitInspectionService } from '../src/modules/inventory/stock-unit-inspection.service';
import { FulfillmentPreparationService } from '../src/modules/operations/fulfillment-preparation.service';
import { BookingStageProjectorService } from '../src/modules/operations/booking-stage-projector.service';
import { BookingOperationsProjectionQueryService } from '../src/modules/operations/booking-operations-projection-query.service';

async function createReviewFixture(prisma: PrismaClient, assigned = true) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const owner = await prisma.user.create({
    data: {
      fullName: 'Booking Reviewer',
      email: `booking-reviewer-${suffix}@example.test`,
      passwordHash: 'integration-only',
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      businessName: 'Booking Review Store',
      subdomain: `booking-review-${suffix}`,
      ownerUserId: owner.id,
    },
  });
  const [customer, location, category, color, sizeSchema] = await Promise.all([
    prisma.customer.create({ data: { tenantId: tenant.id, fullName: 'Review Customer' } }),
    prisma.inventoryLocation.create({
      data: {
        tenantId: tenant.id,
        code: 'MAIN',
        name: 'Main warehouse',
        locationType: 'WAREHOUSE',
        canCustomerPickup: true,
        createdByUserId: owner.id,
      },
    }),
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Review Dresses', slug: `review-dresses-${suffix}` },
    }),
    prisma.color.create({
      data: { tenantId: tenant.id, name: `Review Blue ${suffix}`, hexCode: '#2244aa' },
    }),
    prisma.sizeSchema.create({
      data: {
        tenantId: tenant.id,
        code: `REV-${suffix}`,
        name: 'Review size schema',
        status: 'active',
      },
    }),
  ]);
  const size = await prisma.sizeInstance.create({
    data: { sizeSchemaId: sizeSchema.id, normalizedKey: 'M', displayLabel: 'Medium' },
  });
  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      name: 'Review Dress',
      slug: `review-dress-${suffix}`,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      tenantId: tenant.id,
      productId: product.id,
      mainColorId: color.id,
      variantName: 'Blue',
    },
  });
  const sku = await prisma.variantSize.create({
    data: { tenantId: tenant.id, variantId: variant.id, sizeInstanceId: size.id },
  });
  const unit = await prisma.stockUnit.create({
    data: {
      tenantId: tenant.id,
      variantSizeId: sku.id,
      locationId: location.id,
      assetCode: `REV-${suffix}-001`,
    },
  });
  await prisma.stockUnitCustody.create({
    data: {
      tenantId: tenant.id,
      stockUnitId: unit.id,
      custodyType: 'BUSINESS_LOCATION',
      locationId: location.id,
      custodianRef: location.id,
    },
  });
  const rentalStart = new Date(Date.now() + 30 * 86_400_000);
  const rentalEnd = new Date(Date.now() + 32 * 86_400_000);
  const booking = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      bookingNumber: `BK-REVIEW-${suffix}`,
      customerId: customer.id,
      sourceLocationId: location.id,
      rentalStartDate: rentalStart,
      rentalEndDate: rentalEnd,
      handoverMethod: 'CUSTOMER_PICKUP',
      returnMethod: 'CUSTOMER_RETURN',
      paymentMethod: 'cod',
      subtotal: 2000,
      totalDeposit: 1000,
      grandTotal: 3000,
      deliveryName: customer.fullName,
      deliveryPhone: '01700000000',
      deliveryAddressLine1: 'Dhanmondi',
      deliveryCity: 'Dhaka',
      deliveryCountry: 'BD',
    },
  });
  const bookingItem = await prisma.bookingItem.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking.id,
      productId: product.id,
      variantId: variant.id,
      variantSizeId: sku.id,
      quantity: 1,
      productName: product.name,
      variantName: variant.variantName,
      colorName: color.name,
      sizeInfo: size.displayLabel,
      featuredImageUrl: '/integration/review-dress.jpg',
      startDate: rentalStart,
      endDate: rentalEnd,
      rentalDays: 3,
      baseRental: 2000,
      depositAmount: 1000,
      itemTotal: 2000,
    },
  });
  const requirement = await prisma.fulfillmentRequirement.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking.id,
      bookingItemId: bookingItem.id,
      requirementKey: 'main',
      role: 'MAIN',
      selectionSource: 'MAIN_PRODUCT',
      status: assigned ? 'ASSIGNED' : 'RESERVED',
      productId: product.id,
      variantSizeId: sku.id,
      sourceLocationId: location.id,
      availabilityPolicySnapshot: {
        eligibleOperationalStates: ['AVAILABLE'],
        eligibleConditionGrades: ['NEW', 'EXCELLENT', 'GOOD'],
      },
      quantity: 1,
      assignedQuantity: assigned ? 1 : 0,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant.variantName,
      sizeSnapshot: size.displayLabel,
      rentalStartDate: rentalStart,
      rentalEndDate: rentalEnd,
      blockedStartDate: rentalStart,
      blockedEndDate: rentalEnd,
      revenueAllocation: 2000,
    },
  });
  const reservation = await prisma.inventoryReservation.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking.id,
      bookingItemId: bookingItem.id,
      fulfillmentRequirementId: requirement.id,
      productId: product.id,
      variantSizeId: sku.id,
      sourceLocationId: location.id,
      quantity: 1,
      rentalStartDate: rentalStart,
      rentalEndDate: rentalEnd,
      blockedStartDate: rentalStart,
      blockedEndDate: rentalEnd,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  const assignment = assigned
    ? await prisma.stockUnitAssignment.create({
        data: {
          tenantId: tenant.id,
          reservationId: reservation.id,
          stockUnitId: unit.id,
          assignedByUserId: owner.id,
          blockedStartDate: rentalStart,
          blockedEndDate: rentalEnd,
        },
      })
    : null;
  return { owner, tenant, booking, bookingItem, requirement, reservation, assignment, unit };
}

describe('booking operations foundation PostgreSQL contracts', () => {
  const prisma = new PrismaClient();
  const events = new OperationalEventService(prisma as never);
  const versions = new BookingVersionService(events);
  const queries = new OperationsQueryService(prisma as never);
  const reviews = new BookingReviewService(prisma as never, events);
  const lifecycle = new StockUnitLifecycleService(prisma as never);
  const inspections = new StockUnitInspectionService(prisma as never, lifecycle, events);
  const preparation = new FulfillmentPreparationService(prisma as never, events);
  const stageProjector = new BookingStageProjectorService();
  const operationsProjection = new BookingOperationsProjectionQueryService(
    prisma as never,
    stageProjector,
  );

  afterAll(async () => prisma.$disconnect());

  it('creates one immutable Booking Version 1 and one idempotent operational event', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({
      data: {
        fullName: 'Operations Foundation Owner',
        email: `operations-owner-${suffix}@example.test`,
        passwordHash: 'integration-only',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        businessName: 'Operations Foundation Store',
        subdomain: `operations-${suffix}`,
        ownerUserId: owner.id,
      },
    });
    const customer = await prisma.customer.create({
      data: { tenantId: tenant.id, fullName: 'Operations Customer' },
    });
    const booking = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        bookingNumber: `BK-OPS-${suffix}`,
        customerId: customer.id,
        paymentMethod: 'cod',
        subtotal: 2000,
        totalDeposit: 1000,
        grandTotal: 3000,
        deliveryName: customer.fullName,
        deliveryPhone: '01700000000',
        deliveryAddressLine1: 'Dhanmondi',
        deliveryCity: 'Dhaka',
        deliveryCountry: 'BD',
      },
    });

    const create = () =>
      prisma.$transaction(
        (tx) =>
          versions.createInitial(tx, {
            tenantId: tenant.id,
            bookingId: booking.id,
            snapshot: {
              bookingNumber: booking.bookingNumber,
              pricing: { grandTotal: booking.grandTotal, totalDeposit: booking.totalDeposit },
            },
            reason: 'Integration booking request',
            actorUserId: owner.id,
            occurredAt: booking.createdAt,
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    const first = await create();
    const replay = await create();

    expect(replay.id).toBe(first.id);
    await expect(prisma.bookingVersion.count({ where: { bookingId: booking.id } })).resolves.toBe(
      1,
    );
    await expect(prisma.operationalEvent.count({ where: { bookingId: booking.id } })).resolves.toBe(
      1,
    );
    await expect(queries.listBookingEvents(tenant.id, booking.id)).resolves.toEqual([
      expect.objectContaining({
        eventType: 'BOOKING_CREATED',
        aggregateId: booking.id,
        actor: { id: owner.id, fullName: owner.fullName },
      }),
    ]);

    await expect(
      prisma.financialEntry.create({
        data: {
          tenantId: tenant.id,
          bookingId: booking.id,
          kind: 'RENTAL_CHARGE',
          direction: 'CUSTOMER_RECEIVABLE',
          amount: 0,
          source: 'integration-test',
          reason: 'Zero-value entries must be rejected',
          idempotencyKey: `zero-entry:${booking.id}`,
          effectiveAt: new Date(),
        },
      }),
    ).rejects.toThrow('financial_entries_amount_positive');
  });

  it('approves exact inventory once and reconstructs an idempotent replay', async () => {
    const fixture = await createReviewFixture(prisma);
    await prisma.$transaction((tx) =>
      versions.createInitial(tx, {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        snapshot: { bookingNumber: fixture.booking.bookingNumber },
        reason: 'Integration review request',
        actorUserId: fixture.owner.id,
      }),
    );
    const context = {
      tenantId: fixture.tenant.id,
      bookingId: fixture.booking.id,
      actorUserId: fixture.owner.id,
      idempotencyKey: `approve:${fixture.booking.id}`,
    };
    const command = {
      expectedVersion: 1,
      reason: 'Customer and commercial terms verified',
      outboundMethod: 'CUSTOMER_PICKUP' as const,
      rentalStartPolicy: 'VERIFIED_HANDOVER' as const,
    };

    const approved = await reviews.approveAndReserve(context, command);
    const replay = await reviews.approveAndReserve(context, command);

    expect(approved).toMatchObject({
      replayed: false,
      booking: { status: 'confirmed' },
      bookingVersion: { version: 2, decision: 'APPROVED' },
    });
    expect(approved.fulfillmentGroups).toHaveLength(1);
    expect(approved.fulfillmentGroups[0]).toMatchObject({
      direction: 'OUTBOUND',
      method: 'CUSTOMER_PICKUP',
      originLocationId: fixture.reservation.sourceLocationId,
    });
    expect(approved.fulfillmentGroups[0].fulfillments[0].allocations).toEqual([
      expect.objectContaining({
        assignmentId: fixture.assignment?.id,
        stockUnitId: fixture.unit.id,
        status: 'PLANNED',
      }),
    ]);
    expect(replay).toMatchObject({
      replayed: true,
      bookingVersion: { id: approved.bookingVersion.id, version: 2 },
    });
    await expect(
      prisma.inventoryReservation.findUniqueOrThrow({ where: { id: fixture.reservation.id } }),
    ).resolves.toMatchObject({ status: 'CONFIRMED', expiresAt: null });
    await expect(
      prisma.bookingVersion.count({ where: { bookingId: fixture.booking.id } }),
    ).resolves.toBe(2);
    await expect(
      prisma.operationalEvent.count({
        where: { bookingId: fixture.booking.id, eventType: 'BOOKING_APPROVED_AND_RESERVED' },
      }),
    ).resolves.toBe(1);

    await expect(
      reviews.approveAndReserve(context, { ...command, reason: 'Different request' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });
  });

  it('returns structured blockers without partially approving incomplete allocation', async () => {
    const fixture = await createReviewFixture(prisma, false);
    await prisma.$transaction((tx) =>
      versions.createInitial(tx, {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        snapshot: { bookingNumber: fixture.booking.bookingNumber },
        reason: 'Integration review request',
        actorUserId: fixture.owner.id,
      }),
    );

    await expect(
      reviews.approveAndReserve(
        {
          tenantId: fixture.tenant.id,
          bookingId: fixture.booking.id,
          actorUserId: fixture.owner.id,
          idempotencyKey: `approve-incomplete:${fixture.booking.id}`,
        },
        { expectedVersion: 1 },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BOOKING_APPROVAL_BLOCKED',
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'EXACT_ASSIGNMENTS_INCOMPLETE' }),
        ]),
      }),
    });
    await expect(
      prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }),
    ).resolves.toMatchObject({ status: 'pending', confirmedAt: null });
    await expect(
      prisma.fulfillmentGroup.count({ where: { bookingId: fixture.booking.id } }),
    ).resolves.toBe(0);
  });

  it('links Ready Check to the approved assignment/version and advances preparation from evidence', async () => {
    const fixture = await createReviewFixture(prisma);
    await prisma.$transaction((tx) =>
      versions.createInitial(tx, {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        snapshot: { bookingNumber: fixture.booking.bookingNumber },
        reason: 'Integration review request',
        actorUserId: fixture.owner.id,
      }),
    );
    const approved = await reviews.approveAndReserve(
      {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        actorUserId: fixture.owner.id,
        idempotencyKey: `approve-ready-check:${fixture.booking.id}`,
      },
      { expectedVersion: 1, outboundMethod: 'CUSTOMER_PICKUP' },
    );
    const inspection = await inspections.create(
      fixture.tenant.id,
      fixture.unit.id,
      {
        inspectionType: 'PRE_RENTAL',
        assignmentId: fixture.assignment!.id,
        bookingItemId: fixture.bookingItem.id,
        bookingVersionId: approved.bookingVersion.id,
        idempotencyKey: `ready-check-create:${fixture.assignment!.id}`,
      },
      fixture.owner.id,
    );
    await expect(
      operationsProjection.project(fixture.tenant.id, fixture.booking.id),
    ).resolves.toMatchObject({
      stage: 'READY_CHECK',
      currentVersion: { id: approved.bookingVersion.id, version: 2, decision: 'APPROVED' },
      itemProgress: { total: 1, assigned: 1, readyChecked: 0, packed: 0 },
    });
    const completed = await inspections.complete(
      fixture.tenant.id,
      inspection.id,
      {
        conditionAfter: 'GOOD',
        decision: 'AVAILABLE',
        checks: [],
        notes: 'Clean, complete, and ready for customer handover',
        idempotencyKey: `ready-check-complete:${inspection.id}`,
      },
      fixture.owner.id,
    );

    expect(completed).toMatchObject({
      status: 'COMPLETED',
      bookingVersionId: approved.bookingVersion.id,
      readyCheck: {
        passed: true,
        bookingVersionId: approved.bookingVersion.id,
        assignmentId: fixture.assignment!.id,
        recoveryActions: [],
      },
    });
    await expect(
      prisma.fulfillmentAllocation.findFirstOrThrow({
        where: { assignmentId: fixture.assignment!.id },
        include: { fulfillment: { include: { group: true } } },
      }),
    ).resolves.toMatchObject({
      status: 'READY',
      fulfillment: { status: 'PREPARING', group: { status: 'PREPARING' } },
    });
    await expect(
      prisma.operationalEvent.count({
        where: {
          bookingId: fixture.booking.id,
          eventType: { in: ['READY_CHECK_STARTED', 'READY_CHECK_PASSED'] },
        },
      }),
    ).resolves.toBe(2);
    await expect(
      operationsProjection.project(fixture.tenant.id, fixture.booking.id),
    ).resolves.toMatchObject({
      stage: 'PREPARING',
      itemProgress: { total: 1, assigned: 1, readyChecked: 1, packed: 0 },
    });

    const groupId = approved.fulfillmentGroups[0].id;
    const packed = await preparation.completePacking(
      {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        groupId,
        actorUserId: fixture.owner.id,
        idempotencyKey: `complete-packing:${groupId}`,
      },
      { expectedGroupVersion: 0, reason: 'Exact item packed with pickup documents' },
    );
    const packingReplay = await preparation.completePacking(
      {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        groupId,
        actorUserId: fixture.owner.id,
        idempotencyKey: `complete-packing:${groupId}`,
      },
      { expectedGroupVersion: 0, reason: 'Exact item packed with pickup documents' },
    );
    expect(packed).toMatchObject({
      replayed: false,
      group: { status: 'READY', version: 1, fulfillments: [{ status: 'READY' }] },
    });
    expect(packingReplay).toMatchObject({ replayed: true, group: { status: 'READY' } });
    await expect(
      operationsProjection.project(fixture.tenant.id, fixture.booking.id),
    ).resolves.toMatchObject({
      stage: 'READY_HANDOVER',
      dominantAction: { code: 'START_HANDOVER' },
      itemProgress: { total: 1, assigned: 1, readyChecked: 1, packed: 1 },
    });
  });

  it('keeps failed Ready Check out of preparation and creates a blocking recovery exception', async () => {
    const fixture = await createReviewFixture(prisma);
    await prisma.$transaction((tx) =>
      versions.createInitial(tx, {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        snapshot: { bookingNumber: fixture.booking.bookingNumber },
        reason: 'Integration review request',
        actorUserId: fixture.owner.id,
      }),
    );
    const approved = await reviews.approveAndReserve(
      {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        actorUserId: fixture.owner.id,
        idempotencyKey: `approve-failed-ready-check:${fixture.booking.id}`,
      },
      { expectedVersion: 1 },
    );
    const inspection = await inspections.create(
      fixture.tenant.id,
      fixture.unit.id,
      {
        inspectionType: 'PRE_RENTAL',
        assignmentId: fixture.assignment!.id,
        bookingVersionId: approved.bookingVersion.id,
        idempotencyKey: `failed-ready-check-create:${fixture.assignment!.id}`,
      },
      fixture.owner.id,
    );
    const failed = await inspections.complete(
      fixture.tenant.id,
      inspection.id,
      {
        conditionAfter: 'GOOD',
        decision: 'CLEANING',
        checks: [],
        notes: 'Visible stain requires cleaning before handover',
        idempotencyKey: `failed-ready-check-complete:${inspection.id}`,
      },
      fixture.owner.id,
    );

    expect(failed).toMatchObject({
      readyCheck: {
        passed: false,
        recoveryActions: expect.arrayContaining([
          expect.objectContaining({ code: 'SEND_TO_CLEANING' }),
          expect.objectContaining({ code: 'REASSIGN_ITEM' }),
        ]),
      },
    });
    await expect(
      prisma.fulfillmentAllocation.findFirstOrThrow({
        where: { assignmentId: fixture.assignment!.id },
      }),
    ).resolves.toMatchObject({ status: 'PLANNED' });
    await expect(
      prisma.operationalException.findUniqueOrThrow({
        where: {
          tenantId_sourceKey: {
            tenantId: fixture.tenant.id,
            sourceKey: `ready-check:${inspection.id}:failed`,
          },
        },
      }),
    ).resolves.toMatchObject({
      status: 'OPEN',
      isBlocking: true,
      category: 'READY_CHECK_FAILED',
      stockUnitId: fixture.unit.id,
    });
  });

  it('renews a hold as a new pending version and enforces the refreshed version on approval', async () => {
    const fixture = await createReviewFixture(prisma);
    await prisma.$transaction((tx) =>
      versions.createInitial(tx, {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        snapshot: { bookingNumber: fixture.booking.bookingNumber },
        reason: 'Integration review request',
        actorUserId: fixture.owner.id,
      }),
    );
    const renewContext = {
      tenantId: fixture.tenant.id,
      bookingId: fixture.booking.id,
      actorUserId: fixture.owner.id,
      idempotencyKey: `renew:${fixture.booking.id}`,
    };
    const renewal = {
      expectedVersion: 1,
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      reason: 'Customer requested one more day to confirm',
    };

    const renewed = await reviews.renewHold(renewContext, renewal);
    const replay = await reviews.renewHold(renewContext, renewal);
    expect(renewed).toMatchObject({
      replayed: false,
      bookingVersion: { version: 2, decision: 'PENDING' },
    });
    expect(replay).toMatchObject({ replayed: true, bookingVersion: { version: 2 } });
    await expect(
      reviews.approveAndReserve(
        { ...renewContext, idempotencyKey: `approve-stale:${fixture.booking.id}` },
        { expectedVersion: 1 },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'STALE_BOOKING_VERSION', currentVersion: 2 }),
    });

    await expect(
      reviews.approveAndReserve(
        { ...renewContext, idempotencyKey: `approve-renewed:${fixture.booking.id}` },
        { expectedVersion: 2 },
      ),
    ).resolves.toMatchObject({
      booking: { status: 'confirmed' },
      bookingVersion: { version: 3, decision: 'APPROVED' },
    });
  });

  it('rejects a request atomically and releases its inventory', async () => {
    const fixture = await createReviewFixture(prisma);
    await prisma.$transaction((tx) =>
      versions.createInitial(tx, {
        tenantId: fixture.tenant.id,
        bookingId: fixture.booking.id,
        snapshot: { bookingNumber: fixture.booking.bookingNumber },
        reason: 'Integration review request',
        actorUserId: fixture.owner.id,
      }),
    );
    const context = {
      tenantId: fixture.tenant.id,
      bookingId: fixture.booking.id,
      actorUserId: fixture.owner.id,
      idempotencyKey: `reject:${fixture.booking.id}`,
    };
    const command = { expectedVersion: 1, reason: 'Customer identity could not be verified' };

    const rejected = await reviews.rejectRequest(context, command);
    const replay = await reviews.rejectRequest(context, command);
    expect(rejected).toMatchObject({
      replayed: false,
      booking: { status: 'cancelled' },
      bookingVersion: { version: 2, decision: 'REJECTED' },
    });
    expect(replay).toMatchObject({ replayed: true, bookingVersion: { version: 2 } });
    await expect(
      prisma.inventoryReservation.findUniqueOrThrow({ where: { id: fixture.reservation.id } }),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(
      prisma.stockUnitAssignment.findUniqueOrThrow({ where: { id: fixture.assignment?.id } }),
    ).resolves.toEqual(expect.objectContaining({ releasedAt: expect.any(Date) }));
  });
});
