import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  StockUnitDisposition,
  StockUnitOperationalState,
  StockUnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface LifecycleTransitionInput {
  tenantId: string;
  stockUnitId: string;
  actorUserId?: string;
  reason: string;
  targetDisposition?: StockUnitDisposition;
  targetOperationalState?: StockUnitOperationalState;
  idempotencyKey?: string;
  assignmentId?: string;
  inspectionId?: string;
  serviceOrderId?: string;
  issueId?: string;
  metadata?: Prisma.InputJsonValue;
}

const OPERATIONAL_TRANSITIONS: Record<
  StockUnitOperationalState,
  ReadonlySet<StockUnitOperationalState>
> = {
  AVAILABLE: new Set([
    'PREPARING',
    'AWAITING_INSPECTION',
    'CLEANING',
    'WASHING',
    'REPAIRING',
    'IN_TRANSFER',
  ]),
  PREPARING: new Set(['READY', 'AVAILABLE', 'AWAITING_INSPECTION']),
  READY: new Set(['OUT_FOR_RENTAL', 'AVAILABLE', 'AWAITING_INSPECTION']),
  OUT_FOR_RENTAL: new Set(['AWAITING_INSPECTION']),
  AWAITING_INSPECTION: new Set(['AVAILABLE', 'CLEANING', 'WASHING', 'REPAIRING']),
  CLEANING: new Set(['AWAITING_INSPECTION', 'AVAILABLE']),
  WASHING: new Set(['AWAITING_INSPECTION', 'AVAILABLE']),
  REPAIRING: new Set(['AWAITING_INSPECTION']),
  IN_TRANSFER: new Set(['AVAILABLE', 'AWAITING_INSPECTION']),
};

const DISPOSITION_TRANSITIONS: Record<
  StockUnitDisposition,
  ReadonlySet<StockUnitDisposition>
> = {
  ACTIVE: new Set(['QUARANTINED', 'LOST', 'RETIRED']),
  QUARANTINED: new Set(['ACTIVE', 'LOST', 'RETIRED']),
  LOST: new Set(['ACTIVE', 'RETIRED']),
  RETIRED: new Set(),
};

@Injectable()
export class StockUnitLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  transition(input: LifecycleTransitionInput) {
    return this.prisma.$transaction((tx) => this.transitionInTransaction(tx, input), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    input: LifecycleTransitionInput,
  ) {
    if (!input.targetDisposition && !input.targetOperationalState) {
      throw new ConflictException({
        code: 'LIFECYCLE_TRANSITION_INVALID',
        message: 'A target disposition or operational state is required',
      });
    }

    if (input.idempotencyKey) {
      const existingEvent = await tx.stockUnitLifecycleEvent.findFirst({
        where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
        include: { stockUnit: true },
      });
      if (existingEvent) {
        const targetMismatch =
          (input.targetDisposition !== undefined &&
            existingEvent.toDisposition !== input.targetDisposition) ||
          (input.targetOperationalState !== undefined &&
            existingEvent.toOperationalState !== input.targetOperationalState);
        if (
          existingEvent.stockUnitId !== input.stockUnitId ||
          targetMismatch ||
          existingEvent.reason !== input.reason.trim()
        ) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'The idempotency key belongs to another lifecycle command',
          });
        }
        return { stockUnit: existingEvent.stockUnit, event: existingEvent, idempotent: true };
      }
    }

    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM stock_units
      WHERE tenant_id = ${input.tenantId} AND id = ${input.stockUnitId}
      FOR UPDATE
    `);

    const unit = await tx.stockUnit.findFirst({
      where: { id: input.stockUnitId, tenantId: input.tenantId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Stock unit not found');

    const targetDisposition = input.targetDisposition ?? unit.disposition;
    const targetOperationalState = input.targetOperationalState ?? unit.operationalState;

    this.assertDispositionTransition(unit.disposition, targetDisposition);
    this.assertOperationalTransition(unit.operationalState, targetOperationalState);

    if (
      targetDisposition === unit.disposition &&
      targetOperationalState === unit.operationalState
    ) {
      return { stockUnit: unit, event: null, idempotent: true };
    }

    if (
      targetDisposition === StockUnitDisposition.ACTIVE &&
      unit.disposition !== StockUnitDisposition.ACTIVE &&
      !input.inspectionId
    ) {
      throw new ConflictException({
        code: 'INSPECTION_REQUIRED',
        message: 'Recovered or quarantined units require a completed inspection before reactivation',
      });
    }

    if (targetDisposition === StockUnitDisposition.RETIRED) {
      const futureAssignments = await tx.stockUnitAssignment.count({
        where: {
          tenantId: input.tenantId,
          stockUnitId: input.stockUnitId,
          ...(input.assignmentId ? { id: { not: input.assignmentId } } : {}),
          releasedAt: null,
          blockedEndDate: { gte: this.startOfToday() },
        },
      });
      if (futureAssignments > 0) {
        throw new ConflictException({
          code: 'LIFECYCLE_TRANSITION_INVALID',
          message: 'A unit with active or future assignments cannot be retired',
        });
      }
    }

    if (
      targetDisposition === StockUnitDisposition.ACTIVE &&
      targetOperationalState === StockUnitOperationalState.AVAILABLE
    ) {
      await this.assertReadyForAvailability(tx, input.tenantId, input.stockUnitId);
    }

    const legacyStatus = this.resolveLegacyStatus(targetDisposition, targetOperationalState);
    const stockUnit = await tx.stockUnit.update({
      where: { id: input.stockUnitId },
      data: {
        disposition: targetDisposition,
        operationalState: targetOperationalState,
        status: legacyStatus,
        retiredAt:
          targetDisposition === StockUnitDisposition.RETIRED
            ? unit.retiredAt ?? new Date()
            : null,
      },
    });

    const event = await tx.stockUnitLifecycleEvent.create({
      data: {
        tenantId: input.tenantId,
        stockUnitId: input.stockUnitId,
        assignmentId: input.assignmentId ?? null,
        inspectionId: input.inspectionId ?? null,
        serviceOrderId: input.serviceOrderId ?? null,
        issueId: input.issueId ?? null,
        actorUserId: input.actorUserId ?? null,
        fromDisposition: unit.disposition,
        toDisposition: targetDisposition,
        fromOperationalState: unit.operationalState,
        toOperationalState: targetOperationalState,
        reason: input.reason.trim(),
        metadata: input.metadata,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        tenantId: input.tenantId,
        variantSizeId: unit.variantSizeId,
        stockUnitId: input.stockUnitId,
        movementType: this.resolveMovementType(
          unit.disposition,
          targetDisposition,
          unit.operationalState,
          targetOperationalState,
        ),
        beforeState: this.json({
          disposition: unit.disposition,
          operationalState: unit.operationalState,
          legacyStatus: unit.status,
        }),
        afterState: this.json({
          disposition: targetDisposition,
          operationalState: targetOperationalState,
          legacyStatus,
        }),
        reason: input.reason.trim(),
        actorUserId: input.actorUserId ?? null,
      },
    });

    return { stockUnit, event, idempotent: false };
  }

  private assertDispositionTransition(
    current: StockUnitDisposition,
    target: StockUnitDisposition,
  ): void {
    if (current === target) return;
    if (!DISPOSITION_TRANSITIONS[current].has(target)) {
      throw new ConflictException({
        code: 'LIFECYCLE_TRANSITION_INVALID',
        message: `Disposition cannot change from ${current} to ${target}`,
      });
    }
  }

  private assertOperationalTransition(
    current: StockUnitOperationalState,
    target: StockUnitOperationalState,
  ): void {
    if (current === target) return;
    if (!OPERATIONAL_TRANSITIONS[current].has(target)) {
      throw new ConflictException({
        code: 'LIFECYCLE_TRANSITION_INVALID',
        message: `Operational state cannot change from ${current} to ${target}`,
      });
    }
  }

  private async assertReadyForAvailability(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stockUnitId: string,
  ): Promise<void> {
    const [blockingIssues, blockingServiceOrders, incompleteComponents] = await Promise.all([
      tx.stockUnitIssue.count({
        where: {
          tenantId,
          stockUnitId,
          isAvailabilityBlocking: true,
          status: { in: ['OPEN', 'IN_SERVICE'] },
        },
      }),
      tx.inventoryServiceOrder.count({
        where: {
          tenantId,
          stockUnitId,
          isAvailabilityBlocking: true,
          status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
      }),
      tx.stockUnitComponentState.count({
        where: {
          tenantId,
          stockUnitId,
          setComponentDefinition: { absenceBlocksRental: true, isActive: true },
          presence: { in: ['MISSING', 'DAMAGED'] },
        },
      }),
    ]);

    if (blockingIssues > 0 || blockingServiceOrders > 0 || incompleteComponents > 0) {
      throw new ConflictException({
        code: 'STOCK_UNIT_NOT_READY',
        message: 'Blocking issues, service work, or missing set components must be resolved first',
      });
    }
  }

  private resolveLegacyStatus(
    disposition: StockUnitDisposition,
    state: StockUnitOperationalState,
  ): StockUnitStatus {
    if (disposition === StockUnitDisposition.RETIRED) return StockUnitStatus.RETIRED;
    if (disposition === StockUnitDisposition.LOST) return StockUnitStatus.LOST;
    if (
      disposition === StockUnitDisposition.QUARANTINED ||
      ['CLEANING', 'WASHING', 'REPAIRING'].includes(state)
    ) {
      return StockUnitStatus.MAINTENANCE;
    }
    return StockUnitStatus.ACTIVE;
  }

  private resolveMovementType(
    previousDisposition: StockUnitDisposition,
    nextDisposition: StockUnitDisposition,
    previousState: StockUnitOperationalState,
    nextState: StockUnitOperationalState,
  ): InventoryMovementType {
    if (nextDisposition === StockUnitDisposition.RETIRED) {
      return InventoryMovementType.UNIT_RETIRED;
    }
    if (nextDisposition === StockUnitDisposition.LOST) return InventoryMovementType.UNIT_LOST;
    if (
      previousDisposition === StockUnitDisposition.LOST &&
      nextDisposition === StockUnitDisposition.ACTIVE
    ) {
      return InventoryMovementType.UNIT_RECOVERED;
    }
    if (['CLEANING', 'WASHING', 'REPAIRING'].includes(nextState)) {
      return InventoryMovementType.MAINTENANCE_STARTED;
    }
    if (
      ['CLEANING', 'WASHING', 'REPAIRING'].includes(previousState) &&
      nextState === StockUnitOperationalState.AWAITING_INSPECTION
    ) {
      return InventoryMovementType.MAINTENANCE_ENDED;
    }
    return InventoryMovementType.ADMIN_CORRECTION;
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
