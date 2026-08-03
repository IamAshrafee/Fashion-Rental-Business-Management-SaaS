import { ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { InventoryReservationService } from '../inventory-reservation.service';

describe('InventoryReservationService', () => {
  const availability = { check: jest.fn() };
  const service = new InventoryReservationService(availability as never);

  it('expires pending holds idempotently', async () => {
    const tx = {
      inventoryReservation: {
        findMany: jest.fn().mockResolvedValue([{ id: 'reservation-1' }, { id: 'reservation-2' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const now = new Date('2026-08-03T10:00:00Z');

    await expect(service.expirePending(tx as never, now)).resolves.toBe(2);
    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['reservation-1', 'reservation-2'] }, status: 'PENDING' },
      data: expect.objectContaining({ status: 'EXPIRED', releasedAt: now }),
    }));

    tx.inventoryReservation.findMany.mockResolvedValueOnce([]);
    await expect(service.expirePending(tx as never, now)).resolves.toBe(0);
  });

  it('refuses to confirm an expired inventory hold', async () => {
    const tx = {
      inventoryReservation: {
        findMany: jest.fn().mockResolvedValue([{ status: 'EXPIRED', expiresAt: new Date('2026-08-03T09:00:00Z') }]),
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
      service.transitionForBooking(tx as never, 'tenant-1', 'booking-without-inventory', BookingStatus.confirmed),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVENTORY_RESERVATION_MISSING' }) });
  });
});
