import { Prisma, PrismaClient } from '@prisma/client';
import { BookingVersionService } from '../src/modules/operations/booking-version.service';
import { OperationalEventService } from '../src/modules/operations/operational-event.service';
import { OperationsQueryService } from '../src/modules/operations/operations-query.service';

describe('booking operations foundation PostgreSQL contracts', () => {
  const prisma = new PrismaClient();
  const events = new OperationalEventService(prisma as never);
  const versions = new BookingVersionService(events);
  const queries = new OperationsQueryService(prisma as never);

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
});
