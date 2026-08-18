import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { BookingService, computeCartSummary } from './booking.service';
import type { CreateBookingDto } from './dto/booking.dto';

const request = {
  customer: { fullName: 'Nadia Rahman', phone: '01700000000' },
  delivery: { address: 'Dhanmondi', city: 'Dhaka', country: 'BD' },
  items: [
    {
      productId: 'product-1',
      variantId: 'variant-1',
      variantSizeId: 'size-1',
      quantity: 1,
      startDate: '2026-08-10',
      endDate: '2026-08-12',
    },
  ],
  paymentMethod: 'cod',
} as CreateBookingDto;

function requestHash(value: unknown): string {
  const canonicalize = (child: unknown): unknown => {
    if (Array.isArray(child)) return child.map(canonicalize);
    if (child && typeof child === 'object') {
      return Object.fromEntries(
        Object.entries(child)
          .filter(([, nested]) => nested !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    }
    return child;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

const existingBooking = {
  id: 'booking-1',
  creationRequestHash: requestHash(request),
  bookingNumber: 'BK-1001',
  status: 'pending',
  paymentMethod: 'cod',
  subtotal: 150000,
  totalFees: 0,
  shippingFee: 0,
  totalDeposit: 50000,
  discountAmount: 0,
  grandTotal: 200000,
  customer: { id: 'customer-1', fullName: 'Nadia Rahman', identities: [{ value: '01700000000' }] },
  items: [
    {
      id: 'item-1',
      productId: 'product-1',
      variantId: 'variant-1',
      variantSizeId: 'size-1',
      quantity: 1,
      productName: 'Red dress',
      colorName: 'Red',
      sizeInfo: 'M',
      startDate: new Date('2026-08-10T00:00:00.000Z'),
      endDate: new Date('2026-08-12T00:00:00.000Z'),
      rentalDays: 3,
      baseRental: 150000,
      depositAmount: 50000,
      itemTotal: 200000,
    },
  ],
  payments: [],
};

function serviceWith(prisma: object, customerService: object = {}) {
  return new BookingService(
    prisma as never,
    customerService as never,
    { emit: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { createInitial: jest.fn() } as never,
    { project: jest.fn() } as never,
  );
}

describe('BookingService', () => {
  it('preserves bundle adjustments when aggregating authoritative item totals', () => {
    expect(
      computeCartSummary([
        {
          itemTotal: 175_000,
          cleaningFee: 10_000,
          backupSizeFee: 5_000,
          tryOnFee: 0,
          shippingFee: 12_000,
          depositAmount: 50_000,
        },
        {
          itemTotal: 90_000,
          cleaningFee: 0,
          backupSizeFee: 0,
          tryOnFee: 0,
          shippingFee: 12_000,
          depositAmount: 20_000,
        },
      ]),
    ).toEqual({
      subtotal: 250_000,
      totalFees: 15_000,
      totalDeposit: 70_000,
      shippingFee: 12_000,
      grandTotal: 347_000,
    });
  });

  it('returns the original booking for a matching creation idempotency key', async () => {
    const prisma = { booking: { findFirst: jest.fn().mockResolvedValue(existingBooking) } };
    const customerService = { findOrCreateByPhone: jest.fn() };

    const result = await serviceWith(prisma, customerService).createBooking(
      'tenant-1',
      request,
      'manual-booking-draft-1',
    );

    expect(result).toMatchObject({ bookingId: 'booking-1', bookingNumber: 'BK-1001' });
    expect(customerService.findOrCreateByPhone).not.toHaveBeenCalled();
  });

  it('rejects reuse of a booking creation key for different request content', async () => {
    const prisma = { booking: { findFirst: jest.fn().mockResolvedValue(existingBooking) } };
    const conflictingRequest = {
      ...request,
      customer: { ...request.customer, phone: '01800000000' },
    } as CreateBookingDto;

    await expect(
      serviceWith(prisma).createBooking('tenant-1', conflictingRequest, 'manual-booking-draft-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects owner-only pricing controls at the public booking boundary', async () => {
    await expect(
      serviceWith({}).createGuestBooking(
        'tenant-1',
        {
          ...request,
          discount: { type: 'flat', value: 1_000, reason: 'Attempted public override' },
        },
        'guest-key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds the assignment queue and operational projection on the server', async () => {
    const booking = {
      id: 'booking-1',
      status: 'confirmed',
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      grandTotal: 150000,
      totalPaid: 0,
      handoverMethod: 'CUSTOMER_PICKUP',
      returnMethod: 'CUSTOMER_DROPOFF',
      sourceLocation: { id: 'location-1', code: 'MAIN', name: 'Main showroom' },
      customer: {
        id: 'customer-1',
        fullName: 'Nadia Rahman',
        identities: [{ kind: 'phone', value: '01700000000', isPrimary: true }],
      },
      items: [
        {
          id: 'item-1',
          quantity: 2,
          startDate: new Date('2026-08-10T00:00:00.000Z'),
          endDate: new Date('2026-08-12T00:00:00.000Z'),
          depositAmount: 50000,
          depositSettlement: null,
          stockUnitInspections: [],
          stockUnitIssues: [],
          fulfillmentRequirements: [
            {
              status: 'PARTIALLY_ASSIGNED',
              quantity: 2,
              assignedQuantity: 1,
              handedOutQuantity: 0,
              returnedQuantity: 0,
              lostQuantity: 0,
              preparationStatus: 'NOT_STARTED',
            },
          ],
        },
      ],
      _count: { items: 1 },
    };
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([booking]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const result = await serviceWith(prisma).getBookingList('tenant-1', {
      queue: 'ASSIGNMENT',
      itemDateFrom: '2026-08-10',
      page: 1,
      limit: 20,
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'confirmed',
          AND: [
            expect.objectContaining({ OR: expect.any(Array) }),
            { items: { some: { endDate: { gte: new Date('2026-08-10') } } } },
          ],
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
    expect(result.data[0].operations).toMatchObject({
      totalQuantity: 2,
      physicalItemRequired: 2,
      physicalItemAssigned: 1,
      needsAssignment: true,
      nextAction: 'ASSIGN_ITEMS',
    });
  });

  it('keeps a new storefront request in review instead of flagging future operational work as blockers', async () => {
    const booking = {
      id: 'booking-1',
      status: 'pending',
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      grandTotal: 48_000,
      totalPaid: 0,
      handoverMethod: 'DELIVERY',
      returnMethod: 'CUSTOMER_RETURN',
      sourceLocation: null,
      customer: {
        id: 'customer-1',
        fullName: 'Nadia Rahman',
        identities: [{ kind: 'phone', value: '01700000000', isPrimary: true }],
      },
      items: [
        {
          id: 'item-1',
          quantity: 1,
          startDate: new Date('2026-08-10T00:00:00.000Z'),
          endDate: new Date('2026-08-12T00:00:00.000Z'),
          depositAmount: 0,
          depositSettlement: null,
          stockUnitInspections: [],
          stockUnitIssues: [],
          fulfillmentRequirements: [
            {
              status: 'RESERVED',
              quantity: 1,
              assignedQuantity: 1,
              handedOutQuantity: 0,
              returnedQuantity: 0,
              lostQuantity: 0,
              preparationStatus: 'NOT_STARTED',
            },
          ],
        },
      ],
      _count: { items: 1 },
    };
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([booking]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const result = await serviceWith(prisma).getBookingList('tenant-1', { page: 1, limit: 20 });

    expect(result.data[0].operations).toMatchObject({
      nextAction: 'REVIEW',
      blockers: [],
    });
  });

  it('uses the validated 250-row maximum as a defensive service bound', async () => {
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const result = await serviceWith(prisma).getBookingList('tenant-1', {
      page: 1,
      limit: 999,
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 250 }),
    );
    expect(result.meta).toMatchObject({ limit: 250, total: 0 });
  });

  it('posts late-fee changes to item and booking financial totals atomically', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          grandTotal: 200000,
          totalFees: 10000,
          totalPaid: 200000,
          items: [
            {
              id: 'item-1',
              endDate: new Date('2020-01-01T00:00:00.000Z'),
              baseRental: 150000,
              itemTotal: 200000,
              lateDays: 0,
              lateFee: 0,
              product: {
                pricingProfile: {
                  policyVersions: [
                    {
                      lateFeePolicy: {
                        enabled: true,
                        graceHours: 0,
                        mode: 'FLAT',
                        amountMinor: 5000,
                      },
                    },
                  ],
                },
              },
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      bookingItem: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const pricing = { computeLateFee: jest.fn().mockReturnValue(5000) };
    const service = new BookingService(
      prisma as never,
      {} as never,
      { emit: jest.fn() } as never,
      pricing as never,
      {} as never,
      {} as never,
      {} as never,
      { createInitial: jest.fn() } as never,
      { project: jest.fn() } as never,
    );

    const result = await service.calculateLateFees('tenant-1', 'booking-1');

    expect(result).toMatchObject({ lateItemsUpdated: 1, feeDelta: 5000 });
    expect(tx.bookingItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: expect.objectContaining({ lateFee: 5000, itemTotal: { increment: 5000 } }),
    });
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        totalFees: { increment: 5000 },
        grandTotal: 205000,
        paymentStatus: 'partial',
      },
    });
  });
});
