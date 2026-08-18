import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperationsFulfillmentMethod,
  Prisma,
  StockConditionGrade,
  StockUnitOperationalState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApproveAndReserveBookingDto,
  RejectBookingRequestDto,
  RenewBookingHoldDto,
} from '../booking/dto/booking.dto';
import { requestFingerprint } from './domain/idempotency';
import { OperationalEventService } from './operational-event.service';

type ReviewCommand = 'APPROVE_AND_RESERVE' | 'REJECT_REQUEST' | 'RENEW_HOLD';

interface CommandContext {
  tenantId: string;
  bookingId: string;
  actorUserId: string;
  idempotencyKey: string;
}

interface ReviewBlocker {
  code: string;
  message: string;
  entityId?: string;
  count?: number;
}

const ACTIVE_REQUIREMENT_STATUSES = [
  'PLANNED',
  'RESERVED',
  'PARTIALLY_ASSIGNED',
  'ASSIGNED',
] as const;

const REVIEW_REQUIREMENT_INCLUDE = {
  reservation: {
    include: {
      assignments: {
        where: { releasedAt: null },
        orderBy: [{ stockUnitId: 'asc' as const }, { id: 'asc' as const }],
        include: {
          stockUnit: {
            include: {
              custody: true,
              issues: {
                where: {
                  isAvailabilityBlocking: true,
                  status: { in: ['OPEN' as const, 'IN_SERVICE' as const] },
                },
                select: { id: true },
              },
              componentStates: {
                where: {
                  setComponentDefinition: { isActive: true, absenceBlocksRental: true },
                  presence: { in: ['MISSING' as const, 'DAMAGED' as const] },
                },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  },
  substitutions: {
    where: { approvalStatus: 'PENDING' as const },
    select: { id: true },
  },
} satisfies Prisma.FulfillmentRequirementInclude;

type ReviewRequirement = Prisma.FulfillmentRequirementGetPayload<{
  include: typeof REVIEW_REQUIREMENT_INCLUDE;
}>;

@Injectable()
export class BookingReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalEvents: OperationalEventService,
  ) {}

  approveAndReserve(context: CommandContext, dto: ApproveAndReserveBookingDto) {
    return this.runSerializable(async (tx) => {
      const requestHash = requestFingerprint({ command: 'APPROVE_AND_RESERVE', ...dto });
      const booking = await this.lockBooking(tx, context);
      const replay = await this.resolveReplay(tx, context, 'APPROVE_AND_RESERVE', requestHash);
      if (replay) return replay;
      const currentVersion = await this.assertVersion(tx, context, dto.expectedVersion);
      if (booking.status !== 'pending' || currentVersion.decision !== 'PENDING') {
        throw new ConflictException({
          code: 'BOOKING_REVIEW_NOT_OPEN',
          message: 'This booking request is no longer awaiting review',
          currentVersion: currentVersion.version,
        });
      }

      await this.lockReviewRows(tx, context);
      const requirements = await tx.fulfillmentRequirement.findMany({
        where: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          status: { in: [...ACTIVE_REQUIREMENT_STATUSES] },
        },
        orderBy: [{ sourceLocationId: 'asc' }, { id: 'asc' }],
        include: REVIEW_REQUIREMENT_INCLUDE,
      });

      const blockers = this.reviewBlockers(requirements, new Date());
      if (blockers.length > 0) {
        throw new ConflictException({
          code: 'BOOKING_APPROVAL_BLOCKED',
          message: 'Resolve the review blockers before approving this rental',
          blockers,
          recoveryActions: [
            { code: 'ASSIGN_EXACT_ITEMS', label: 'Assign eligible physical items' },
            { code: 'RENEW_HOLD', label: 'Renew inventory hold' },
            { code: 'REVISE_TERMS', label: 'Revise booking terms' },
          ],
          currentVersion: currentVersion.version,
        });
      }

      const assignments = requirements.flatMap((requirement) =>
        (requirement.reservation?.assignments ?? []).map((assignment) => ({
          id: assignment.id,
          stockUnitId: assignment.stockUnitId,
          sourceLocationId: requirement.sourceLocationId,
          requirementId: requirement.id,
          bookingItemId: requirement.bookingItemId,
          assetCode: assignment.stockUnit.assetCode,
        })),
      );
      await this.lockStockUnits(
        tx,
        context.tenantId,
        assignments.map((assignment) => assignment.stockUnitId),
      );

      const approvedAt = new Date();
      const method = this.resolveOutboundMethod(booking.handoverMethod, dto.outboundMethod);
      const policySnapshot = {
        rentalStartPolicy: dto.rentalStartPolicy ?? 'VERIFIED_HANDOVER',
        returnTimelinessPolicy: dto.returnTimelinessPolicy ?? 'CUSTOMER_HANDOVER',
        depositCollectionTiming: dto.depositCollectionTiming ?? 'HANDOVER',
        approvedAt,
        approvedByUserId: context.actorUserId,
      };
      const approvedVersion = await tx.bookingVersion.create({
        data: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          version: currentVersion.version + 1,
          decision: 'APPROVED',
          snapshot: this.json({
            ...(this.objectSnapshot(currentVersion.snapshot) ?? {}),
            review: {
              decision: 'APPROVED',
              reason: dto.reason?.trim() || 'Booking reviewed and exact inventory reserved',
              policy: policySnapshot,
              outboundMethod: method,
              scheduledHandoverAt: dto.scheduledHandoverAt ?? null,
              assignments,
            },
          }),
          reason: dto.reason?.trim() || 'Booking reviewed and exact inventory reserved',
          actorUserId: context.actorUserId,
          approvedAt,
        },
      });

      await tx.inventoryReservation.updateMany({
        where: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          status: 'PENDING',
        },
        data: { status: 'CONFIRMED', expiresAt: null },
      });
      await tx.booking.update({
        where: { id: context.bookingId, tenantId: context.tenantId },
        data: { status: 'confirmed', confirmedAt: approvedAt },
      });

      const groups = [];
      const byLocation = new Map<string, typeof assignments>();
      for (const assignment of assignments) {
        const group = byLocation.get(assignment.sourceLocationId) ?? [];
        group.push(assignment);
        byLocation.set(assignment.sourceLocationId, group);
      }
      for (const [sourceLocationId, groupAssignments] of [...byLocation.entries()].sort()) {
        const group = await tx.fulfillmentGroup.create({
          data: {
            tenantId: context.tenantId,
            bookingId: context.bookingId,
            bookingVersionId: approvedVersion.id,
            direction: 'OUTBOUND',
            method,
            status: 'PLANNED',
            originLocationId: sourceLocationId,
            destinationSnapshot: this.json({
              name: booking.deliveryName,
              phone: booking.deliveryPhone,
              addressLine1: booking.deliveryAddressLine1,
              addressLine2: booking.deliveryAddressLine2,
              city: booking.deliveryCity,
              state: booking.deliveryState,
              postalCode: booking.deliveryPostalCode,
              country: booking.deliveryCountry,
            }),
            policySnapshot: this.json(policySnapshot),
            scheduledHandoverAt: dto.scheduledHandoverAt ? new Date(dto.scheduledHandoverAt) : null,
            fulfillments: {
              create: {
                tenantId: context.tenantId,
                status: 'PLANNED',
                idempotencyKey: `${context.idempotencyKey}:outbound:${sourceLocationId}`,
                requestHash,
                scheduledAt: dto.scheduledHandoverAt ? new Date(dto.scheduledHandoverAt) : null,
                allocations: {
                  create: groupAssignments.map((assignment) => ({
                    tenantId: context.tenantId,
                    assignmentId: assignment.id,
                    stockUnitId: assignment.stockUnitId,
                    status: 'PLANNED',
                  })),
                },
              },
            },
          },
          include: { fulfillments: { include: { allocations: true } } },
        });
        groups.push(group);
      }

      await this.operationalEvents.append(
        {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          category: 'BOOKING',
          eventType: 'BOOKING_APPROVED_AND_RESERVED',
          aggregateType: 'BookingVersion',
          aggregateId: approvedVersion.id,
          actorUserId: context.actorUserId,
          reason: approvedVersion.reason,
          metadata: this.json({
            command: 'APPROVE_AND_RESERVE',
            requestHash,
            bookingVersionId: approvedVersion.id,
            version: approvedVersion.version,
            fulfillmentGroupIds: groups.map((group) => group.id),
          }),
          idempotencyKey: context.idempotencyKey,
          occurredAt: approvedAt,
        },
        tx,
      );

      return this.commandResult(tx, context, approvedVersion.id, false);
    });
  }

  rejectRequest(context: CommandContext, dto: RejectBookingRequestDto) {
    return this.runSerializable(async (tx) => {
      const requestHash = requestFingerprint({ command: 'REJECT_REQUEST', ...dto });
      const booking = await this.lockBooking(tx, context);
      const replay = await this.resolveReplay(tx, context, 'REJECT_REQUEST', requestHash);
      if (replay) return replay;
      const currentVersion = await this.assertVersion(tx, context, dto.expectedVersion);
      if (booking.status !== 'pending' || currentVersion.decision !== 'PENDING') {
        throw new ConflictException({
          code: 'BOOKING_REVIEW_NOT_OPEN',
          message: 'This booking request is no longer awaiting review',
          currentVersion: currentVersion.version,
        });
      }
      await this.lockReviewRows(tx, context);
      const now = new Date();
      const rejectedVersion = await tx.bookingVersion.create({
        data: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          version: currentVersion.version + 1,
          decision: 'REJECTED',
          snapshot: this.json({
            ...(this.objectSnapshot(currentVersion.snapshot) ?? {}),
            review: { decision: 'REJECTED', reason: dto.reason.trim(), rejectedAt: now },
          }),
          reason: dto.reason.trim(),
          actorUserId: context.actorUserId,
          rejectedAt: now,
        },
      });
      await tx.stockUnitAssignment.updateMany({
        where: {
          tenantId: context.tenantId,
          reservation: { bookingId: context.bookingId },
          releasedAt: null,
        },
        data: { releasedAt: now, releaseReason: dto.reason.trim() },
      });
      await tx.inventoryReservation.updateMany({
        where: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        data: { status: 'CANCELLED', cancelledAt: now, releaseReason: dto.reason.trim() },
      });
      await tx.fulfillmentRequirement.updateMany({
        where: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          status: { in: [...ACTIVE_REQUIREMENT_STATUSES] },
        },
        data: { status: 'CANCELLED' },
      });
      await tx.booking.update({
        where: { id: context.bookingId, tenantId: context.tenantId },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: 'owner',
          cancellationReason: dto.reason.trim(),
        },
      });
      await this.operationalEvents.append(
        {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          category: 'BOOKING',
          eventType: 'BOOKING_REQUEST_REJECTED',
          aggregateType: 'BookingVersion',
          aggregateId: rejectedVersion.id,
          actorUserId: context.actorUserId,
          reason: dto.reason.trim(),
          metadata: this.json({
            command: 'REJECT_REQUEST',
            requestHash,
            bookingVersionId: rejectedVersion.id,
            version: rejectedVersion.version,
          }),
          idempotencyKey: context.idempotencyKey,
          occurredAt: now,
        },
        tx,
      );
      return this.commandResult(tx, context, rejectedVersion.id, false);
    });
  }

  renewHold(context: CommandContext, dto: RenewBookingHoldDto) {
    return this.runSerializable(async (tx) => {
      const requestHash = requestFingerprint({ command: 'RENEW_HOLD', ...dto });
      const booking = await this.lockBooking(tx, context);
      const replay = await this.resolveReplay(tx, context, 'RENEW_HOLD', requestHash);
      if (replay) return replay;
      const currentVersion = await this.assertVersion(tx, context, dto.expectedVersion);
      if (booking.status !== 'pending' || currentVersion.decision !== 'PENDING') {
        throw new ConflictException({
          code: 'BOOKING_REVIEW_NOT_OPEN',
          message: 'Only an open booking request can have its hold renewed',
          currentVersion: currentVersion.version,
        });
      }
      const expiresAt = new Date(dto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new BadRequestException({
          code: 'HOLD_EXPIRY_INVALID',
          message: 'The renewed hold expiry must be in the future',
        });
      }
      await this.lockReviewRows(tx, context);
      const updated = await tx.inventoryReservation.updateMany({
        where: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          status: 'PENDING',
        },
        data: { expiresAt },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: 'INVENTORY_RESERVATION_MISSING',
          message: 'This booking has no pending inventory hold to renew',
        });
      }
      const renewedVersion = await tx.bookingVersion.create({
        data: {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          version: currentVersion.version + 1,
          decision: 'PENDING',
          snapshot: this.json({
            ...(this.objectSnapshot(currentVersion.snapshot) ?? {}),
            hold: { expiresAt, renewedAt: new Date(), reason: dto.reason.trim() },
          }),
          reason: dto.reason.trim(),
          actorUserId: context.actorUserId,
        },
      });
      await this.operationalEvents.append(
        {
          tenantId: context.tenantId,
          bookingId: context.bookingId,
          category: 'INVENTORY',
          eventType: 'BOOKING_HOLD_RENEWED',
          aggregateType: 'BookingVersion',
          aggregateId: renewedVersion.id,
          actorUserId: context.actorUserId,
          reason: dto.reason.trim(),
          metadata: this.json({
            command: 'RENEW_HOLD',
            requestHash,
            bookingVersionId: renewedVersion.id,
            version: renewedVersion.version,
            expiresAt,
          }),
          idempotencyKey: context.idempotencyKey,
        },
        tx,
      );
      return this.commandResult(tx, context, renewedVersion.id, false);
    });
  }

  private reviewBlockers(requirements: ReviewRequirement[], now: Date): ReviewBlocker[] {
    const blockers: ReviewBlocker[] = [];
    if (requirements.length === 0) {
      blockers.push({
        code: 'FULFILLMENT_REQUIREMENTS_MISSING',
        message: 'No active fulfillment requirements exist for this booking',
      });
      return blockers;
    }
    for (const requirement of requirements) {
      const reservation = requirement.reservation;
      if (!reservation) {
        blockers.push({
          code: 'INVENTORY_RESERVATION_MISSING',
          message: 'A fulfillment requirement has no inventory reservation',
          entityId: requirement.id,
        });
        continue;
      }
      if (
        !['PENDING', 'CONFIRMED'].includes(reservation.status) ||
        (reservation.status === 'PENDING' && reservation.expiresAt && reservation.expiresAt <= now)
      ) {
        blockers.push({
          code: 'INVENTORY_RESERVATION_EXPIRED',
          message: 'An inventory hold is expired or no longer active',
          entityId: reservation.id,
        });
      }
      if (reservation.assignments.length !== requirement.quantity) {
        blockers.push({
          code: 'EXACT_ASSIGNMENTS_INCOMPLETE',
          message: 'Assign every required exact physical item before approval',
          entityId: requirement.id,
          count: Math.max(0, requirement.quantity - reservation.assignments.length),
        });
      }
      if (requirement.substitutions.length > 0) {
        blockers.push({
          code: 'SUBSTITUTION_APPROVAL_PENDING',
          message: 'A proposed substitution still requires approval',
          entityId: requirement.id,
          count: requirement.substitutions.length,
        });
      }
      for (const assignment of reservation.assignments) {
        const unit = assignment.stockUnit;
        const eligibility = this.assignmentEligibility(requirement.availabilityPolicySnapshot);
        if (
          unit.disposition !== 'ACTIVE' ||
          !eligibility.operationalStates.includes(unit.operationalState) ||
          !eligibility.conditionGrades.includes(unit.condition) ||
          unit.locationId !== requirement.sourceLocationId ||
          unit.deletedAt !== null ||
          unit.issues.length > 0 ||
          unit.componentStates.length > 0
        ) {
          blockers.push({
            code: 'ASSIGNED_UNIT_NOT_ELIGIBLE',
            message: `Physical item ${unit.assetCode} is no longer eligible`,
            entityId: unit.id,
          });
        }
        if (
          !unit.custody ||
          unit.custody.custodyType !== 'BUSINESS_LOCATION' ||
          unit.custody.locationId !== requirement.sourceLocationId
        ) {
          blockers.push({
            code: 'ASSIGNED_UNIT_CUSTODY_UNCONFIRMED',
            message: `Physical item ${unit.assetCode} is not confirmed at its source location`,
            entityId: unit.id,
          });
        }
      }
    }
    return blockers;
  }

  private assignmentEligibility(snapshot: Prisma.JsonValue) {
    const value = this.objectSnapshot(snapshot) ?? {};
    const operationalStates = Array.isArray(value.eligibleOperationalStates)
      ? value.eligibleOperationalStates.filter(
          (item): item is StockUnitOperationalState =>
            typeof item === 'string' &&
            Object.values(StockUnitOperationalState).includes(item as StockUnitOperationalState),
        )
      : [StockUnitOperationalState.AVAILABLE];
    const conditionGrades = Array.isArray(value.eligibleConditionGrades)
      ? value.eligibleConditionGrades.filter(
          (item): item is StockConditionGrade =>
            typeof item === 'string' &&
            Object.values(StockConditionGrade).includes(item as StockConditionGrade),
        )
      : [StockConditionGrade.NEW, StockConditionGrade.EXCELLENT, StockConditionGrade.GOOD];
    return { operationalStates, conditionGrades };
  }

  private async resolveReplay(
    tx: Prisma.TransactionClient,
    context: CommandContext,
    command: ReviewCommand,
    requestHash: string,
  ) {
    const event = await tx.operationalEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: context.tenantId,
          idempotencyKey: context.idempotencyKey,
        },
      },
    });
    if (!event) return null;
    const metadata = this.objectSnapshot(event.metadata);
    if (metadata?.command !== command || metadata.requestHash !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This idempotency key was already used for a different review command',
      });
    }
    const bookingVersionId = metadata.bookingVersionId;
    if (typeof bookingVersionId !== 'string') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_REPLAY_CORRUPT',
        message: 'The original command result cannot be reconstructed safely',
      });
    }
    return this.commandResult(tx, context, bookingVersionId, true);
  }

  private async commandResult(
    tx: Prisma.TransactionClient,
    context: CommandContext,
    bookingVersionId: string,
    replayed: boolean,
  ) {
    const [booking, bookingVersion, fulfillmentGroups] = await Promise.all([
      tx.booking.findFirstOrThrow({
        where: { id: context.bookingId, tenantId: context.tenantId },
      }),
      tx.bookingVersion.findFirstOrThrow({
        where: { id: bookingVersionId, bookingId: context.bookingId, tenantId: context.tenantId },
      }),
      tx.fulfillmentGroup.findMany({
        where: { bookingVersionId, tenantId: context.tenantId },
        include: { fulfillments: { include: { allocations: true } } },
        orderBy: [{ originLocationId: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      replayed,
      booking,
      bookingVersion,
      fulfillmentGroups,
      fulfillmentPlan: {
        originCount: fulfillmentGroups.length,
        requiresConsolidation: fulfillmentGroups.length > 1,
      },
    };
  }

  private async lockBooking(tx: Prisma.TransactionClient, context: CommandContext) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM bookings
      WHERE tenant_id = ${context.tenantId}
        AND id = ${context.bookingId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);
    const booking = await tx.booking.findFirst({
      where: { id: context.bookingId, tenantId: context.tenantId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async assertVersion(
    tx: Prisma.TransactionClient,
    context: CommandContext,
    expectedVersion: number,
  ) {
    const currentVersion = await tx.bookingVersion.findFirst({
      where: { tenantId: context.tenantId, bookingId: context.bookingId },
      orderBy: { version: 'desc' },
    });
    if (!currentVersion) {
      throw new ConflictException({
        code: 'BOOKING_VERSION_MISSING',
        message: 'This booking has no immutable version record',
      });
    }
    if (currentVersion.version !== expectedVersion) {
      throw new ConflictException({
        code: 'STALE_BOOKING_VERSION',
        message: 'This booking changed after it was opened. Reload before continuing.',
        expectedVersion,
        currentVersion: currentVersion.version,
      });
    }
    return currentVersion;
  }

  private async lockReviewRows(tx: Prisma.TransactionClient, context: CommandContext) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM fulfillment_requirements
      WHERE tenant_id = ${context.tenantId} AND booking_id = ${context.bookingId}
      ORDER BY id FOR UPDATE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM inventory_reservations
      WHERE tenant_id = ${context.tenantId} AND booking_id = ${context.bookingId}
      ORDER BY id FOR UPDATE
    `);
  }

  private async lockStockUnits(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stockUnitIds: string[],
  ) {
    const ids = [...new Set(stockUnitIds)].sort();
    if (ids.length === 0) return;
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM stock_units
      WHERE tenant_id = ${tenantId} AND id IN (${Prisma.join(ids)})
      ORDER BY id FOR UPDATE
    `);
    if (locked.length !== ids.length) {
      throw new ConflictException({
        code: 'ASSIGNED_UNIT_MISSING',
        message: 'One or more assigned physical items no longer exist',
      });
    }
  }

  private resolveOutboundMethod(
    handoverMethod: 'DELIVERY' | 'CUSTOMER_PICKUP' | null,
    requested?: ApproveAndReserveBookingDto['outboundMethod'],
  ): OperationsFulfillmentMethod {
    if (requested) return requested;
    return handoverMethod === 'CUSTOMER_PICKUP'
      ? OperationsFulfillmentMethod.CUSTOMER_PICKUP
      : OperationsFulfillmentMethod.COURIER;
  }

  private objectSnapshot(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, Prisma.JsonValue>)
      : null;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async runSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 3
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException({
      code: 'BOOKING_REVIEW_CONFLICT',
      message: 'The booking changed during review. Reload and try again.',
    });
  }
}
