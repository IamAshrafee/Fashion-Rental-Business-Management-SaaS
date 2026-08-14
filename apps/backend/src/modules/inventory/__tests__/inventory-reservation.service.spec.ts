import { ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { InventoryReservationService } from '../inventory-reservation.service';

describe('InventoryReservationService', () => {
  const availability = { check: jest.fn() };
  const service = new InventoryReservationService(availability as never);

  it('expires pending holds idempotently', async () => {
    const tx = {
      inventoryReservation: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'reservation-1',
              tenantId: 'tenant-1',
              fulfillmentRequirementId: 'requirement-1',
              fulfillmentRequirement: { status: 'RESERVED', quantity: 1 },
            },
            {
              id: 'reservation-2',
              tenantId: 'tenant-1',
              fulfillmentRequirementId: 'requirement-2',
              fulfillmentRequirement: { status: 'RESERVED', quantity: 1 },
            },
          ])
          .mockResolvedValueOnce([{ bookingId: 'booking-1' }, { bookingId: 'booking-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      fulfillmentRequirement: { updateMany: jest.fn() },
      fulfillmentRequirementEvent: { createMany: jest.fn() },
      booking: { updateMany: jest.fn() },
    };
    const now = new Date('2026-08-03T10:00:00Z');

    await expect(service.expirePending(tx as never, 'tenant-1', now)).resolves.toBe(2);
    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          id: { in: ['reservation-1', 'reservation-2'] },
          status: 'PENDING',
        },
        data: expect.objectContaining({ status: 'EXPIRED', releasedAt: now }),
      }),
    );
    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['booking-1'] }, status: 'pending' }),
        data: expect.objectContaining({ status: 'cancelled', cancelledBy: 'system' }),
      }),
    );

    tx.inventoryReservation.findMany.mockResolvedValueOnce([]);
    await expect(service.expirePending(tx as never, 'tenant-1', now)).resolves.toBe(0);
  });

  it('refuses to confirm an expired inventory hold', async () => {
    const tx = {
      inventoryReservation: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ status: 'EXPIRED', expiresAt: new Date('2026-08-03T09:00:00Z') }]),
        updateMany: jest.fn(),
      },
    };

    await expect(
      service.transitionForBooking(tx as never, 'tenant-1', 'booking-1', BookingStatus.confirmed),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventoryReservation.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to confirm a booking that has no inventory reservations', async () => {
    const tx = {
      inventoryReservation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      service.transitionForBooking(
        tx as never,
        'tenant-1',
        'booking-without-inventory',
        BookingStatus.confirmed,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVENTORY_RESERVATION_MISSING' }),
    });
  });

  it('attributes completed rental revenue to physical assignments in stable order', async () => {
    const tx = {
      fulfillmentRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'requirement-1',
            bookingItemId: 'booking-item-1',
            revenueAllocation: 5,
            reservation: {
              assignments: [
                { id: 'assignment-1', stockUnitId: 'unit-1' },
                { id: 'assignment-2', stockUnitId: 'unit-2' },
              ],
            },
          },
        ]),
      },
      stockUnitRevenueAllocation: { createMany: jest.fn() },
      stockUnitAssignment: { updateMany: jest.fn() },
      inventoryReservation: { updateMany: jest.fn() },
    };

    await service.transitionForBooking(
      tx as never,
      'tenant-1',
      'booking-1',
      BookingStatus.completed,
      'Rental completed',
    );

    expect(tx.stockUnitRevenueAllocation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          assignmentId: 'assignment-1',
          stockUnitId: 'unit-1',
          amount: 3,
        }),
        expect.objectContaining({
          assignmentId: 'assignment-2',
          stockUnitId: 'unit-2',
          amount: 2,
        }),
      ],
      skipDuplicates: true,
    });
    expect(tx.stockUnitAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', releasedAt: null }),
      }),
    );
  });
});
