import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FulfillmentEventType,
  FulfillmentRequirementStatus,
  InventoryTrackingMode,
  Prisma,
  StockConditionGrade,
  StockUnitOperationalState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listEligibleUnits(tenantId: string, bookingId: string, bookingItemId: string, requirementId: string) {
    const reservation = await this.getReservation(this.prisma, tenantId, bookingId, bookingItemId, requirementId);
    if (reservation.variantSize?.trackingMode !== InventoryTrackingMode.SERIALIZED) {
      return { requirement: reservation.fulfillmentRequirement, reservationId: reservation.id, required: 0, assigned: [], eligible: [] };
    }
    const eligibility = this.assignmentEligibility(
      reservation.fulfillmentRequirement.availabilityPolicySnapshot,
    );

    const [assigned, eligible] = await Promise.all([
      this.prisma.stockUnitAssignment.findMany({
        where: { tenantId, reservationId: reservation.id, releasedAt: null },
        include: { stockUnit: { include: { location: true } } },
        orderBy: { assignedAt: 'asc' },
      }),
      this.prisma.stockUnit.findMany({
        where: {
          tenantId,
          ...(reservation.preferredStockUnitId
            ? { id: reservation.preferredStockUnitId }
            : {}),
          variantSizeId: reservation.variantSize.id,
          locationId: reservation.sourceLocationId,
          disposition: 'ACTIVE',
          operationalState: { in: eligibility.operationalStates },
          condition: { in: eligibility.conditionGrades },
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
        include: { location: true },
      }),
    ]);

    return {
      requirement: reservation.fulfillmentRequirement,
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
    actorUserId: string | undefined,
    requirementId: string,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
        const reservation = await this.getReservation(tx, tenantId, bookingId, bookingItemId, requirementId);
        if (reservation.variantSize?.trackingMode !== InventoryTrackingMode.SERIALIZED) {
          throw new ConflictException('Physical units are only assigned to serialized inventory');
        }
        if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
          throw new ConflictException('Inventory reservation is no longer active');
        }
        const eligibility = this.assignmentEligibility(
          reservation.fulfillmentRequirement.availabilityPolicySnapshot,
        );

        const sortedIds = [...new Set(stockUnitIds)].sort();
        if (
          reservation.preferredStockUnitId &&
          (sortedIds.length !== 1 || sortedIds[0] !== reservation.preferredStockUnitId)
        ) {
          throw new ConflictException({
            code: 'PREFERRED_STOCK_UNIT_REQUIRED',
            message: 'This booking reserved a specific customer-selected physical item',
          });
        }
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
            locationId: reservation.sourceLocationId,
            disposition: 'ACTIVE',
            operationalState: { in: eligibility.operationalStates },
            condition: { in: eligibility.conditionGrades },
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

        const assignedQuantity = existingCount + sortedIds.length;
        const requirementStatus = assignedQuantity === reservation.quantity
          ? FulfillmentRequirementStatus.ASSIGNED
          : FulfillmentRequirementStatus.PARTIALLY_ASSIGNED;
        await tx.fulfillmentRequirement.update({
          where: { id: reservation.fulfillmentRequirementId },
          data: { assignedQuantity, status: requirementStatus },
        });
        await tx.fulfillmentRequirementEvent.create({
          data: {
            tenantId,
            requirementId: reservation.fulfillmentRequirementId,
            eventType: FulfillmentEventType.ASSIGNED,
            quantity: sortedIds.length,
            fromStatus: reservation.fulfillmentRequirement.status,
            toStatus: requirementStatus,
            reason: 'Physical units assigned to fulfillment requirement',
            actorUserId: actorUserId ?? null,
          },
        });

        return tx.stockUnitAssignment.findMany({
          where: { tenantId, reservationId: reservation.id, releasedAt: null },
          include: { stockUnit: { include: { location: true } } },
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
    actorUserId: string | undefined,
    requirementId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.stockUnitAssignment.findFirst({
        where: {
          id: assignmentId,
          tenantId,
          reservation: {
            bookingId,
            bookingItemId,
            fulfillmentRequirementId: requirementId,
          },
          releasedAt: null,
        },
        include: { reservation: { include: { fulfillmentRequirement: true } } },
      });
      if (!assignment) throw new NotFoundException('Active stock-unit assignment not found');
      if (assignment.reservation.fulfillmentRequirement.handedOutQuantity > 0) {
        throw new ConflictException('Handed-out units must be returned or marked lost instead of released');
      }
      const updated = await tx.stockUnitAssignment.update({
        where: { id: assignmentId },
        data: { releasedAt: new Date(), releaseReason: reason.trim() },
      });
      const assignedQuantity = Math.max(0, assignment.reservation.fulfillmentRequirement.assignedQuantity - 1);
      const status = assignedQuantity > 0
        ? FulfillmentRequirementStatus.PARTIALLY_ASSIGNED
        : FulfillmentRequirementStatus.RESERVED;
      await tx.fulfillmentRequirement.update({
        where: { id: assignment.reservation.fulfillmentRequirementId },
        data: { assignedQuantity, status },
      });
      await tx.fulfillmentRequirementEvent.create({
        data: {
          tenantId,
          requirementId: assignment.reservation.fulfillmentRequirementId,
          assignmentId,
          eventType: FulfillmentEventType.ASSIGNMENT_RELEASED,
          quantity: 1,
          fromStatus: assignment.reservation.fulfillmentRequirement.status,
          toStatus: status,
          reason: reason.trim(),
          actorUserId: actorUserId ?? null,
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async getReservation(
    db: Prisma.TransactionClient,
    tenantId: string,
    bookingId: string,
    bookingItemId: string,
    requirementId: string,
  ) {
    const reservation = await db.inventoryReservation.findFirst({
      where: {
        tenantId,
        bookingId,
        bookingItemId,
        fulfillmentRequirementId: requirementId,
      },
      include: { variantSize: true, fulfillmentRequirement: true },
    });
    if (!reservation) throw new NotFoundException('Inventory reservation not found');
    return reservation;
  }

  private assignmentEligibility(snapshot: Prisma.JsonValue) {
    const value = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? snapshot as Record<string, Prisma.JsonValue>
      : {};
    const conditions = Array.isArray(value.eligibleConditionGrades)
      ? value.eligibleConditionGrades.filter(
          (item): item is StockConditionGrade =>
            typeof item === 'string' && Object.values(StockConditionGrade).includes(item as StockConditionGrade),
        )
      : [
          StockConditionGrade.NEW,
          StockConditionGrade.EXCELLENT,
          StockConditionGrade.GOOD,
          StockConditionGrade.FAIR,
        ];
    const states = Array.isArray(value.eligibleOperationalStates)
      ? value.eligibleOperationalStates.filter(
          (item): item is StockUnitOperationalState =>
            typeof item === 'string' &&
            Object.values(StockUnitOperationalState).includes(item as StockUnitOperationalState),
        )
      : [StockUnitOperationalState.AVAILABLE];
    return {
      conditionGrades: conditions,
      operationalStates: states,
    };
  }
}
