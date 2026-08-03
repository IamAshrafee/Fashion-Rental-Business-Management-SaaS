import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTrackingMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listEligibleUnits(tenantId: string, bookingId: string, bookingItemId: string) {
    const reservation = await this.getReservation(this.prisma, tenantId, bookingId, bookingItemId);
    if (reservation.variantSize?.trackingMode !== InventoryTrackingMode.SERIALIZED) {
      return { reservationId: reservation.id, required: 0, assigned: [], eligible: [] };
    }

    const [assigned, eligible] = await Promise.all([
      this.prisma.stockUnitAssignment.findMany({
        where: { tenantId, reservationId: reservation.id, releasedAt: null },
        include: { stockUnit: true },
        orderBy: { assignedAt: 'asc' },
      }),
      this.prisma.stockUnit.findMany({
        where: {
          tenantId,
          variantSizeId: reservation.variantSize.id,
          disposition: 'ACTIVE',
          status: 'ACTIVE',
          condition: { not: 'DAMAGED' },
          deletedAt: null,
          issues: {
            none: {
              isAvailabilityBlocking: true,
              status: { in: ['OPEN', 'IN_SERVICE'] },
            },
          },
          componentStates: {
            none: {
              setComponentDefinition: { isActive: true, absenceBlocksRental: true },
              presence: { in: ['MISSING', 'DAMAGED'] },
            },
          },
          blocks: {
            none: {
              startDate: { lte: reservation.blockedEndDate },
              endDate: { gte: reservation.blockedStartDate },
            },
          },
          assignments: {
            none: {
              releasedAt: null,
              blockedStartDate: { lte: reservation.blockedEndDate },
              blockedEndDate: { gte: reservation.blockedStartDate },
              reservationId: { not: reservation.id },
            },
          },
        },
        orderBy: { assetCode: 'asc' },
      }),
    ]);

    return {
      reservationId: reservation.id,
      required: reservation.quantity,
      assigned,
      eligible,
    };
  }

  async assign(
    tenantId: string,
    bookingId: string,
    bookingItemId: string,
    stockUnitIds: string[],
    actorUserId?: string,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
        const reservation = await this.getReservation(tx, tenantId, bookingId, bookingItemId);
        if (reservation.variantSize?.trackingMode !== InventoryTrackingMode.SERIALIZED) {
          throw new ConflictException('Physical units are only assigned to serialized inventory');
        }
        if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
          throw new ConflictException('Inventory reservation is no longer active');
        }

        const sortedIds = [...new Set(stockUnitIds)].sort();
        await tx.$queryRaw(Prisma.sql`
          SELECT id
          FROM stock_units
          WHERE tenant_id = ${tenantId}
            AND id IN (${Prisma.join(sortedIds)})
          ORDER BY id
          FOR UPDATE
        `);

        const existingCount = await tx.stockUnitAssignment.count({
          where: { tenantId, reservationId: reservation.id, releasedAt: null },
        });
        if (existingCount + sortedIds.length > reservation.quantity) {
          throw new ConflictException({
            code: 'STOCK_UNIT_ASSIGNMENT_CONFLICT',
            message: 'Assignments would exceed the reserved quantity',
          });
        }

        const units = await tx.stockUnit.findMany({
          where: {
            id: { in: sortedIds },
            tenantId,
            variantSizeId: reservation.variantSize.id,
            disposition: 'ACTIVE',
            status: 'ACTIVE',
            condition: { not: 'DAMAGED' },
            deletedAt: null,
            issues: {
              none: {
                isAvailabilityBlocking: true,
                status: { in: ['OPEN', 'IN_SERVICE'] },
              },
            },
            componentStates: {
              none: {
                setComponentDefinition: { isActive: true, absenceBlocksRental: true },
                presence: { in: ['MISSING', 'DAMAGED'] },
              },
            },
          },
          select: { id: true, assetCode: true },
        });
        if (units.length !== sortedIds.length) {
          throw new ConflictException({
            code: 'STOCK_UNIT_NOT_ELIGIBLE',
            message: 'One or more stock units are not eligible for this reservation',
          });
        }

        const conflictCount = await tx.inventoryBlock.count({
          where: {
            tenantId,
            stockUnitId: { in: sortedIds },
            startDate: { lte: reservation.blockedEndDate },
            endDate: { gte: reservation.blockedStartDate },
          },
        });
        const assignmentConflictCount = await tx.stockUnitAssignment.count({
          where: {
            tenantId,
            stockUnitId: { in: sortedIds },
            releasedAt: null,
            blockedStartDate: { lte: reservation.blockedEndDate },
            blockedEndDate: { gte: reservation.blockedStartDate },
          },
        });
        if (conflictCount > 0 || assignmentConflictCount > 0) {
          throw new ConflictException({
            code: 'STOCK_UNIT_ASSIGNMENT_CONFLICT',
            message: 'One or more stock units are blocked or already assigned for these dates',
          });
        }

        await tx.stockUnitAssignment.createMany({
          data: sortedIds.map((stockUnitId) => ({
            tenantId,
            reservationId: reservation.id,
            stockUnitId,
            assignedByUserId: actorUserId ?? null,
            blockedStartDate: reservation.blockedStartDate,
            blockedEndDate: reservation.blockedEndDate,
          })),
        });

        return tx.stockUnitAssignment.findMany({
          where: { tenantId, reservationId: reservation.id, releasedAt: null },
          include: { stockUnit: true },
          orderBy: { assignedAt: 'asc' },
        });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < maxAttempts
        ) {
          continue;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2004', 'P2034'].includes(error.code)) {
          throw new ConflictException({
            code: 'STOCK_UNIT_ASSIGNMENT_CONFLICT',
            message: 'A selected stock unit was assigned by another operation',
          });
        }
        throw error;
      }
    }
    throw new ConflictException({
      code: 'STOCK_UNIT_ASSIGNMENT_CONFLICT',
      message: 'A selected stock unit could not be assigned',
    });
  }

  async release(
    tenantId: string,
    bookingId: string,
    bookingItemId: string,
    assignmentId: string,
    reason: string,
  ) {
    const assignment = await this.prisma.stockUnitAssignment.findFirst({
      where: {
        id: assignmentId,
        tenantId,
        reservation: { bookingId, bookingItemId },
        releasedAt: null,
      },
    });
    if (!assignment) throw new NotFoundException('Active stock-unit assignment not found');

    return this.prisma.stockUnitAssignment.update({
      where: { id: assignmentId },
      data: { releasedAt: new Date(), releaseReason: reason.trim() },
    });
  }

  private async getReservation(
    db: Prisma.TransactionClient,
    tenantId: string,
    bookingId: string,
    bookingItemId: string,
  ) {
    const reservation = await db.inventoryReservation.findFirst({
      where: { tenantId, bookingId, bookingItemId },
      include: { variantSize: true },
    });
    if (!reservation) throw new NotFoundException('Inventory reservation not found');
    return reservation;
  }
}
