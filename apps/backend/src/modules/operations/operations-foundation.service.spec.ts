import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingVersionService } from './booking-version.service';
import { OperationalEventService } from './operational-event.service';
import { StockUnitCustodyService } from './stock-unit-custody.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BookingVersionService', () => {
  let service: BookingVersionService;
  const operationalEvents = { append: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingVersionService,
        { provide: OperationalEventService, useValue: operationalEvents },
      ],
    }).compile();
    service = module.get(BookingVersionService);
  });

  it('creates immutable Version 1 and its timeline event in the caller transaction', async () => {
    const version = {
      id: 'version-1',
      bookingId: 'booking-1',
      version: 1,
      reason: 'Customer submitted storefront booking request',
    };
    const tx = {
      bookingVersion: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(version),
      },
    };

    await expect(
      service.createInitial(tx as never, {
        tenantId: 'tenant-1',
        bookingId: 'booking-1',
        snapshot: { grandTotal: 3000 },
        reason: version.reason,
        actorUserId: null,
        occurredAt: new Date('2026-08-18T10:00:00.000Z'),
      }),
    ).resolves.toBe(version);

    expect(tx.bookingVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        bookingId: 'booking-1',
        version: 1,
        decision: 'PENDING',
        snapshot: { grandTotal: 3000 },
      }),
    });
    expect(operationalEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'BOOKING_CREATED',
        idempotencyKey: 'booking-created:booking-1',
      }),
      tx,
    );
  });

  it('replays an existing Version 1 without appending another event', async () => {
    const existing = { id: 'version-1', bookingId: 'booking-1', version: 1 };
    const tx = {
      bookingVersion: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };

    await expect(
      service.createInitial(tx as never, {
        tenantId: 'tenant-1',
        bookingId: 'booking-1',
        snapshot: {},
        reason: 'Replay',
      }),
    ).resolves.toBe(existing);
    expect(tx.bookingVersion.create).not.toHaveBeenCalled();
    expect(operationalEvents.append).not.toHaveBeenCalled();
  });
});

describe('StockUnitCustodyService', () => {
  let service: StockUnitCustodyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockUnitCustodyService,
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(StockUnitCustodyService);
  });

  it('initializes registered inventory in business-location custody', async () => {
    const custody = { id: 'custody-1', stockUnitId: 'unit-1' };
    const tx = {
      stockUnitCustody: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(custody),
      },
      custodyEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };

    await expect(
      service.initializeBusinessLocation(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        locationId: 'warehouse-1',
        idempotencyKey: 'register:unit-1',
      }),
    ).resolves.toMatchObject({ custody, idempotent: false });

    expect(tx.stockUnitCustody.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        custodyType: 'BUSINESS_LOCATION',
        locationId: 'warehouse-1',
        custodianRef: 'warehouse-1',
      }),
    });
    expect(tx.custodyEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromCustodyType: 'UNKNOWN',
        toCustodyType: 'BUSINESS_LOCATION',
        reason: 'REGISTERED',
      }),
    });
  });

  it('moves custody with optimistic concurrency and an append-only event', async () => {
    const current = {
      id: 'custody-1',
      tenantId: 'tenant-1',
      stockUnitId: 'unit-1',
      custodyType: 'BUSINESS_LOCATION',
      locationId: 'warehouse-1',
      custodianRef: 'warehouse-1',
      version: 4,
    };
    const updated = { ...current, custodyType: 'CUSTOMER', locationId: null, version: 5 };
    const tx = {
      $queryRaw: jest.fn(),
      custodyEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      stockUnitCustody: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
    };

    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        expectedVersion: 4,
        toCustodyType: 'CUSTOMER',
        toCustodianRef: 'customer-1',
        reason: 'CUSTOMER_RECEIPT',
        idempotencyKey: 'handover:item-1',
      }),
    ).resolves.toMatchObject({ custody: updated, idempotent: false });

    expect(tx.stockUnitCustody.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ stockUnitId: 'unit-1', version: 4 }),
      data: expect.objectContaining({
        custodyType: 'CUSTOMER',
        locationId: null,
        custodianRef: 'customer-1',
        version: { increment: 1 },
      }),
    });
    expect(tx.custodyEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromCustodyType: 'BUSINESS_LOCATION',
        toCustodyType: 'CUSTOMER',
        fromLocationId: 'warehouse-1',
        reason: 'CUSTOMER_RECEIPT',
      }),
    });
  });

  it('rejects stale custody commands with a refreshable version', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      custodyEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      stockUnitCustody: {
        findFirst: jest.fn().mockResolvedValue({
          tenantId: 'tenant-1',
          stockUnitId: 'unit-1',
          custodyType: 'BUSINESS_LOCATION',
          locationId: 'warehouse-1',
          custodianRef: 'warehouse-1',
          version: 5,
        }),
      },
    };

    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        expectedVersion: 4,
        toCustodyType: 'CUSTOMER',
        reason: 'CUSTOMER_RECEIPT',
        idempotencyKey: 'handover:item-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'STALE_CUSTODY_VERSION',
        currentVersion: 5,
      }),
    });
  });

  it('requires a structured location for location-backed custody', async () => {
    const tx = {
      custodyEvent: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        expectedVersion: 0,
        toCustodyType: 'RECEIVING_AREA',
        reason: 'RETURN_RECEIPT',
        idempotencyKey: 'return:item-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CUSTODY_LOCATION_REQUIRED' }),
    });
  });
});
