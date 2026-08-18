import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStageProjectorService } from './booking-stage-projector.service';
import type {
  BookingOperationItemInput,
  InspectionProjectionState,
  PackingState,
  ReadyCheckState,
  ReturnIntakeProjectionState,
} from './domain/operations.types';

const ACTIVE_REQUIREMENT_STATUSES = [
  'PLANNED',
  'RESERVED',
  'PARTIALLY_ASSIGNED',
  'ASSIGNED',
  'PARTIALLY_HANDED_OUT',
  'HANDED_OUT',
  'PARTIALLY_RETURNED',
  'RETURNED',
  'LOST',
  'OVERDUE',
] as const;

@Injectable()
export class BookingOperationsProjectionQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projector: BookingStageProjectorService,
  ) {}

  async project(tenantId: string, bookingId: string, now = new Date()) {
    const [booking, currentVersion] = await Promise.all([
      this.prisma.booking.findFirst({
        where: { id: bookingId, tenantId, deletedAt: null },
        select: {
          id: true,
          status: true,
          grandTotal: true,
          totalPaid: true,
          totalDeposit: true,
          rentalEndDate: true,
          sourceLocation: { select: { timezone: true } },
        },
      }),
      this.prisma.bookingVersion.findFirst({
        where: { tenantId, bookingId },
        orderBy: { version: 'desc' },
      }),
    ]);
    if (!booking) throw new NotFoundException('Booking not found');

    const [
      requirements,
      financialEntries,
      exceptions,
      tasks,
      closeCycles,
      unresolvedDamageCount,
      customerReturnHandover,
    ] = await Promise.all([
      this.prisma.fulfillmentRequirement.findMany({
        where: {
          tenantId,
          bookingId,
          status: { in: [...ACTIVE_REQUIREMENT_STATUSES] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          sourceLocation: { select: { id: true, code: true, name: true } },
          reservation: {
            include: {
              assignments: {
                where: { releasedAt: null },
                orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
                include: {
                  stockUnit: { include: { custody: true } },
                  inspections: {
                    where: {
                      ...(currentVersion ? { bookingVersionId: currentVersion.id } : {}),
                      status: { in: ['DRAFT', 'COMPLETED'] },
                    },
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  },
                  fulfillmentAllocations: {
                    where: {
                      ...(currentVersion
                        ? { fulfillment: { group: { bookingVersionId: currentVersion.id } } }
                        : {}),
                      status: { not: 'CANCELLED' },
                    },
                    include: {
                      fulfillment: {
                        select: { status: true, group: { select: { status: true } } },
                      },
                    },
                  },
                  expectedReturnIntakeItems: {
                    where: { returnIntake: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    include: { returnIntake: { select: { status: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.financialEntry.findMany({
        where: {
          tenantId,
          bookingId,
          status: { notIn: ['REVERSED', 'WAIVED'] },
        },
        select: { kind: true, direction: true, status: true, amount: true },
      }),
      this.prisma.operationalException.findMany({
        where: { tenantId, bookingId, status: { notIn: ['RESOLVED', 'WAIVED'] } },
        select: { severity: true, status: true, isBlocking: true },
      }),
      this.prisma.operationalTask.findMany({
        where: { tenantId, bookingId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { dueAt: true },
      }),
      this.prisma.bookingCloseCycle.findMany({
        where: { tenantId, bookingId },
        orderBy: { cycleNumber: 'desc' },
        take: 1,
      }),
      this.prisma.stockUnitIssue.count({
        where: {
          tenantId,
          bookingItem: { bookingId },
          status: { in: ['OPEN', 'IN_SERVICE'] },
          isAvailabilityBlocking: true,
        },
      }),
      this.prisma.custodyEvent.findFirst({
        where: {
          tenantId,
          reason: 'RETURN_HANDOVER',
          stockUnit: { assignments: { some: { reservation: { bookingId } } } },
        },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      }),
    ]);

    const items: BookingOperationItemInput[] = [];
    for (const requirement of requirements) {
      const assignments = requirement.reservation?.assignments ?? [];
      for (const assignment of assignments) {
        const preRental = assignment.inspections.find(
          (inspection) => inspection.inspectionType === 'PRE_RENTAL',
        );
        const returnInspection = assignment.inspections.find(
          (inspection) => inspection.inspectionType === 'RETURN',
        );
        const allocation = assignment.fulfillmentAllocations[0] ?? null;
        const intake = assignment.expectedReturnIntakeItems[0] ?? null;
        items.push({
          id: assignment.id,
          assignmentState: 'ASSIGNED',
          readyCheckState: this.readyCheckState(preRental),
          packingState: this.packingState(allocation),
          custody: assignment.stockUnit.custody?.custodyType ?? 'UNKNOWN',
          outboundFulfillmentStatus: allocation?.fulfillment.status ?? null,
          returnIntakeState: this.returnIntakeState(intake?.returnIntake.status),
          inspectionState: this.inspectionState(returnInspection),
          requiresReturn: true,
          returnResolved: Boolean(intake && ['RECEIVED', 'LOST'].includes(intake.outcome)),
        });
      }
      for (let index = assignments.length; index < requirement.quantity; index += 1) {
        items.push({
          id: `${requirement.id}:unassigned:${index}`,
          assignmentState: 'UNASSIGNED',
          readyCheckState: 'PENDING',
          packingState: 'NOT_STARTED',
          custody: null,
          outboundFulfillmentStatus: null,
          returnIntakeState: 'NOT_STARTED',
          inspectionState: 'NOT_REQUIRED',
          requiresReturn: true,
          returnResolved: false,
        });
      }
    }

    const customerReceivableFromLedger = this.sumDirection(financialEntries, 'CUSTOMER_RECEIVABLE');
    const customerCredit = this.sumDirection(financialEntries, 'CUSTOMER_LIABILITY');
    const depositRequired =
      this.sumKind(financialEntries, 'DEPOSIT_REQUIREMENT') || booking.totalDeposit;
    const depositHeld = this.sumKind(financialEntries, 'DEPOSIT_COLLECTION');
    const refundDue = this.sumKind(financialEntries, 'REFUND_OBLIGATION');
    const latestClose = closeCycles[0] ?? null;
    const decision =
      currentVersion?.decision === 'APPROVED' || currentVersion?.decision === 'REJECTED'
        ? currentVersion.decision
        : 'PENDING';
    const missingRequiredRecordCount = decision === 'APPROVED' && items.length === 0 ? 1 : 0;
    const activeHolds = requirements
      .map((requirement) => requirement.reservation)
      .filter((reservation): reservation is NonNullable<typeof reservation> =>
        Boolean(reservation?.status === 'PENDING' && reservation.expiresAt),
      );
    const holdExpiresAt = activeHolds.reduce<Date | null>((earliest, reservation) => {
      if (!reservation.expiresAt) return earliest;
      return !earliest || reservation.expiresAt < earliest ? reservation.expiresAt : earliest;
    }, null);
    const origins = new Map<string, { id: string; code: string; name: string }>();
    for (const requirement of requirements) {
      if (requirement.sourceLocationId && requirement.sourceLocation) {
        origins.set(requirement.sourceLocationId, requirement.sourceLocation);
      }
    }

    return {
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            version: currentVersion.version,
            decision: currentVersion.decision,
            approvedAt: currentVersion.approvedAt,
            rejectedAt: currentVersion.rejectedAt,
            reason: currentVersion.reason,
          }
        : null,
      review: {
        holdExpiresAt,
        holdExpired: Boolean(holdExpiresAt && holdExpiresAt <= now),
        exactAssignmentComplete:
          items.length > 0 && items.every((item) => item.assignmentState === 'ASSIGNED'),
        originLocations: [...origins.values()],
      },
      ...this.projector.project({
        decision,
        cancelled: booking.status === 'cancelled' && decision !== 'REJECTED',
        closed:
          (latestClose?.status === 'COMPLETED' && latestClose.closeType !== 'REOPEN') ||
          booking.status === 'completed',
        reopened: latestClose?.closeType === 'REOPEN' && latestClose.status === 'COMPLETED',
        now,
        timeZone: booking.sourceLocation?.timezone ?? 'Asia/Dhaka',
        returnDueAt: booking.rentalEndDate,
        customerReturnHandoverAt: customerReturnHandover?.occurredAt ?? null,
        items,
        financial: {
          customerReceivable:
            customerReceivableFromLedger || Math.max(0, booking.grandTotal - booking.totalPaid),
          customerCredit,
          depositRequired,
          depositHeld,
          depositUnresolved: Math.max(0, depositRequired - depositHeld),
          refundDue,
          courierReceivable: this.sumDirection(financialEntries, 'COURIER_RECEIVABLE'),
          failedRefundCount: financialEntries.filter(
            (entry) => entry.kind === 'REFUND_OBLIGATION' && entry.status === 'FAILED',
          ).length,
        },
        exceptions: {
          blockingCount: exceptions.filter((exception) => exception.isBlocking).length,
          openCount: exceptions.length,
          criticalCount: exceptions.filter((exception) => exception.severity === 'CRITICAL').length,
          onHold: exceptions.some((exception) => exception.status === 'ON_HOLD'),
        },
        tasks: {
          openCount: tasks.length,
          overdueCount: tasks.filter((task) => task.dueAt && task.dueAt < now).length,
        },
        close: { unresolvedDamageCount, missingRequiredRecordCount },
      }),
      fulfillmentGroups: await this.prisma.fulfillmentGroup.findMany({
        where: { tenantId, bookingId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          originLocation: { select: { id: true, code: true, name: true } },
          fulfillments: {
            include: {
              allocations: {
                include: {
                  stockUnit: { select: { id: true, assetCode: true } },
                  assignment: {
                    select: { id: true, reservation: { select: { bookingItemId: true } } },
                  },
                },
                orderBy: [{ stockUnitId: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
      }),
    };
  }

  private readyCheckState(
    inspection: { status: string; decision: string | null } | null | undefined,
  ): ReadyCheckState {
    if (!inspection || inspection.status === 'DRAFT') return 'PENDING';
    return inspection.decision === 'AVAILABLE' ? 'PASSED' : 'FAILED';
  }

  private packingState(
    allocation: {
      status: string;
      fulfillment: { status: string; group: { status: string } };
    } | null,
  ): PackingState {
    if (!allocation) return 'NOT_STARTED';
    if (
      allocation.fulfillment.group.status === 'READY' ||
      ['HANDED_OVER', 'RECEIVED'].includes(allocation.status)
    ) {
      return 'READY';
    }
    return allocation.status === 'READY' ? 'IN_PROGRESS' : 'NOT_STARTED';
  }

  private returnIntakeState(status?: string): ReturnIntakeProjectionState {
    if (status === 'COMPLETED') return 'COMPLETED';
    if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'NOT_STARTED';
  }

  private inspectionState(
    inspection: { inspectionType: string; status: string } | null | undefined,
  ): InspectionProjectionState {
    if (!inspection) return 'PENDING';
    return inspection.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
  }

  private sumDirection(entries: Array<{ direction: string; amount: number }>, direction: string) {
    return entries.reduce(
      (total, entry) => total + (entry.direction === direction ? entry.amount : 0),
      0,
    );
  }

  private sumKind(entries: Array<{ kind: string; amount: number }>, kind: string) {
    return entries.reduce((total, entry) => total + (entry.kind === kind ? entry.amount : 0), 0);
  }
}
