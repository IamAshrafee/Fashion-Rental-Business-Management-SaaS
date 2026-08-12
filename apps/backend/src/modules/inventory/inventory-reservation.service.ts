import { ConflictException, Injectable } from '@nestjs/common';
import { BookingStatus, InventoryReservationStatus, Prisma } from '@prisma/client';
import { InventoryAvailabilityService } from './inventory-availability.service';

interface CreateReservationInput {
  tenantId: string;
  bookingId: string;
  bookingItemId: string;
  fulfillmentRequirementId: string;
  productId: string;
  variantSizeId: string;
  sourceLocationId: string;
  quantity: number;
  startDate: string | Date;
  endDate: string | Date;
  status: InventoryReservationStatus;
  expiresAt?: Date | null;
}

@Injectable()
export class InventoryReservationService {
  constructor(private readonly availability: InventoryAvailabilityService) {}

  async lockVariantSizes(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeIds: string[],
  ): Promise<void> {
    const ids = [...new Set(variantSizeIds)].sort();
    if (ids.length === 0) return;

    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM variant_sizes
      WHERE tenant_id = ${tenantId}
        AND id IN (${Prisma.join(ids)})
      ORDER BY id
      FOR UPDATE
    `);

    if (rows.length !== ids.length) {
      throw new ConflictException({
        code: 'VARIANT_SIZE_NOT_FOUND',
        message: 'One or more selected inventory items no longer exist',
      });
    }
  }

  async create(tx: Prisma.TransactionClient, input: CreateReservationInput) {
    const availability = await this.availability.check(
      {
        tenantId: input.tenantId,
        productId: input.productId,
        variantSizeId: input.variantSizeId,
        sourceLocationId: input.sourceLocationId,
        startDate: input.startDate,
        endDate: input.endDate,
        quantity: input.quantity,
      },
      tx,
    );

    if (!availability.available) {
      throw new ConflictException({
        code: 'INVENTORY_CAPACITY_CONFLICT',
        message: availability.reason ?? 'Requested inventory is no longer available',
        details: {
          variantSizeId: input.variantSizeId,
          requestedQuantity: input.quantity,
          remainingQuantity: availability.remainingQuantity,
        },
      });
    }

    return tx.inventoryReservation.create({
      data: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        bookingItemId: input.bookingItemId,
        fulfillmentRequirementId: input.fulfillmentRequirementId,
        productId: input.productId,
        variantSizeId: input.variantSizeId,
        sourceLocationId: input.sourceLocationId,
        quantity: input.quantity,
        rentalStartDate: new Date(availability.rentalRange.start),
        rentalEndDate: new Date(availability.rentalRange.end),
        blockedStartDate: new Date(availability.effectiveBlockedRange.start),
        blockedEndDate: new Date(availability.effectiveBlockedRange.end),
        status: input.status,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  async transitionForBooking(
    tx: Prisma.TransactionClient,
    tenantId: string,
    bookingId: string,
    bookingStatus: BookingStatus,
    reason?: string,
  ): Promise<void> {
    const now = new Date();

    if (bookingStatus === BookingStatus.confirmed) {
      const reservations = await tx.inventoryReservation.findMany({
        where: { tenantId, bookingId },
        select: { status: true, expiresAt: true },
      });
      if (reservations.length === 0) {
        throw new ConflictException({
          code: 'INVENTORY_RESERVATION_MISSING',
          message: 'This booking cannot be confirmed because it has no inventory reservation',
        });
      }
      const unavailableReservation = reservations.find(
        (reservation) =>
          !['PENDING', 'CONFIRMED'].includes(reservation.status) ||
          (reservation.status === 'PENDING' &&
            reservation.expiresAt !== null &&
            reservation.expiresAt <= now),
      );
      if (unavailableReservation) {
        throw new ConflictException({
          code: 'INVENTORY_RESERVATION_EXPIRED',
          message: 'This booking can no longer be confirmed because its inventory hold has expired',
        });
      }
      await tx.inventoryReservation.updateMany({
        where: { tenantId, bookingId, status: 'PENDING' },
        data: { status: 'CONFIRMED', expiresAt: null },
      });
      return;
    }

    if (bookingStatus === BookingStatus.cancelled) {
      await tx.stockUnitAssignment.updateMany({
        where: { tenantId, reservation: { bookingId }, releasedAt: null },
        data: { releasedAt: now, releaseReason: reason ?? 'Booking cancelled' },
      });
      await tx.inventoryReservation.updateMany({
        where: { tenantId, bookingId, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          releaseReason: reason ?? 'Booking cancelled',
        },
      });
      return;
    }

    if (bookingStatus === BookingStatus.completed) {
      await this.allocateCompletedRentalRevenue(tx, tenantId, bookingId);
      await tx.stockUnitAssignment.updateMany({
        where: { tenantId, reservation: { bookingId }, releasedAt: null },
        data: { releasedAt: now, releaseReason: reason ?? 'Booking completed' },
      });
      await tx.inventoryReservation.updateMany({
        where: { tenantId, bookingId, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: {
          status: 'RELEASED',
          releasedAt: now,
          releaseReason: reason ?? 'Booking completed',
        },
      });
    }
  }

  private async allocateCompletedRentalRevenue(
    tx: Prisma.TransactionClient,
    tenantId: string,
    bookingId: string,
  ): Promise<void> {
    const requirements = await tx.fulfillmentRequirement.findMany({
      where: { tenantId, bookingId, status: { notIn: ['CANCELLED', 'SUPERSEDED'] } },
      select: {
        id: true,
        bookingItemId: true,
        revenueAllocation: true,
        reservation: {
          select: {
            assignments: {
              where: { releasedAt: null },
              orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
              select: { id: true, stockUnitId: true },
            },
          },
        },
      },
    });

    const allocations = requirements.flatMap((requirement) => {
      const assignments = requirement.reservation?.assignments ?? [];
      if (assignments.length === 0 || requirement.revenueAllocation === 0) return [];
      const baseAmount = Math.trunc(requirement.revenueAllocation / assignments.length);
      let remainder = requirement.revenueAllocation - baseAmount * assignments.length;
      return assignments.map((assignment) => {
        const remainderAmount = remainder === 0 ? 0 : remainder > 0 ? 1 : -1;
        remainder -= remainderAmount;
        return {
          tenantId,
          stockUnitId: assignment.stockUnitId,
          assignmentId: assignment.id,
          bookingId,
          bookingItemId: requirement.bookingItemId,
          fulfillmentRequirementId: requirement.id,
          allocationKind: 'RENTAL_REVENUE' as const,
          amount: baseAmount + remainderAmount,
          sourceKey: `booking:${bookingId}:requirement:${requirement.id}:assignment:${assignment.id}:rental-revenue`,
          reason: 'Attributed when the booking completed',
        };
      });
    });
    if (allocations.length > 0) {
      await tx.stockUnitRevenueAllocation.createMany({ data: allocations, skipDuplicates: true });
    }
  }

  async expirePending(
    tx: Prisma.TransactionClient,
    tenantId: string,
    now = new Date(),
  ): Promise<number> {
    const expired = await tx.inventoryReservation.findMany({
      where: { tenantId, status: 'PENDING', expiresAt: { not: null, lte: now } },
      select: {
        id: true,
        tenantId: true,
        fulfillmentRequirementId: true,
        fulfillmentRequirement: { select: { status: true, quantity: true } },
      },
    });
    if (expired.length === 0) return 0;

    await tx.inventoryReservation.updateMany({
      where: { tenantId, id: { in: expired.map((item) => item.id) }, status: 'PENDING' },
      data: { status: 'EXPIRED', releasedAt: now, releaseReason: 'Pending hold expired' },
    });
    const requirementIds = expired.flatMap((item) =>
      item.fulfillmentRequirementId ? [item.fulfillmentRequirementId] : [],
    );
    if (requirementIds.length) {
      await tx.fulfillmentRequirement.updateMany({
        where: { tenantId, id: { in: requirementIds } },
        data: { status: 'CANCELLED' },
      });
      await tx.fulfillmentRequirementEvent.createMany({
        data: expired.flatMap((item) =>
          item.fulfillmentRequirementId
            ? [
                {
                  tenantId: item.tenantId,
                  requirementId: item.fulfillmentRequirementId,
                  eventType: 'CANCELLED' as const,
                  quantity: item.fulfillmentRequirement.quantity,
                  fromStatus: item.fulfillmentRequirement.status,
                  toStatus: 'CANCELLED' as const,
                  reason: 'Pending inventory hold expired',
                },
              ]
            : [],
        ),
      });
    }
    const expiredBookingIds = [
      ...new Set(
        (
          await tx.inventoryReservation.findMany({
            where: { tenantId, id: { in: expired.map((item) => item.id) } },
            select: { bookingId: true },
          })
        ).map((item) => item.bookingId),
      ),
    ];
    if (expiredBookingIds.length) {
      await tx.booking.updateMany({
        where: {
          tenantId,
          id: { in: expiredBookingIds },
          status: 'pending',
          inventoryReservations: { none: { status: { in: ['PENDING', 'CONFIRMED'] } } },
        },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: 'system',
          cancellationReason: 'Inventory hold expired before confirmation',
        },
      });
    }
    return expired.length;
  }
}
