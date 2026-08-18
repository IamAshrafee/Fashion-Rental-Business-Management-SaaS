import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompleteFulfillmentPackingDto } from '../booking/dto/booking.dto';
import { requestFingerprint } from './domain/idempotency';
import { OperationalEventService } from './operational-event.service';

interface PackingContext {
  tenantId: string;
  bookingId: string;
  groupId: string;
  actorUserId: string;
  idempotencyKey: string;
}

@Injectable()
export class FulfillmentPreparationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalEvents: OperationalEventService,
  ) {}

  completePacking(context: PackingContext, dto: CompleteFulfillmentPackingDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT id FROM fulfillment_groups
          WHERE id = ${context.groupId}
            AND tenant_id = ${context.tenantId}
            AND booking_id = ${context.bookingId}
          FOR UPDATE
        `);
        const requestHash = requestFingerprint({ command: 'COMPLETE_PACKING', ...dto });
        const replay = await tx.operationalEvent.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: context.tenantId,
              idempotencyKey: context.idempotencyKey,
            },
          },
        });
        if (replay) {
          const metadata = this.object(replay.metadata);
          if (
            metadata?.command !== 'COMPLETE_PACKING' ||
            metadata.requestHash !== requestHash ||
            metadata.groupId !== context.groupId
          ) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'This idempotency key was already used for different packing work',
            });
          }
          return this.result(tx, context, true);
        }

        const group = await tx.fulfillmentGroup.findFirst({
          where: {
            id: context.groupId,
            tenantId: context.tenantId,
            bookingId: context.bookingId,
          },
          include: {
            bookingVersion: { select: { decision: true, version: true } },
            fulfillments: {
              include: {
                allocations: {
                  where: { status: { not: 'CANCELLED' } },
                  orderBy: [{ stockUnitId: 'asc' }, { id: 'asc' }],
                },
              },
            },
          },
        });
        if (!group) throw new NotFoundException('Outbound fulfillment group not found');
        if (group.version !== dto.expectedGroupVersion) {
          throw new ConflictException({
            code: 'STALE_FULFILLMENT_GROUP',
            message:
              'This preparation group changed after it was opened. Reload before continuing.',
            expectedVersion: dto.expectedGroupVersion,
            currentVersion: group.version,
          });
        }
        if (group.direction !== 'OUTBOUND' || group.bookingVersion.decision !== 'APPROVED') {
          throw new ConflictException({
            code: 'PACKING_PLAN_INVALID',
            message: 'Packing requires an outbound group from an approved booking version',
          });
        }
        if (group.status === 'READY') return this.result(tx, context, true);
        if (group.status !== 'PREPARING') {
          throw new ConflictException({
            code: 'PACKING_NOT_READY_TO_COMPLETE',
            message: 'Complete every Ready Check before finishing packing',
            currentStatus: group.status,
          });
        }
        const allocations = group.fulfillments.flatMap((fulfillment) => fulfillment.allocations);
        const notReady = allocations.filter((allocation) => allocation.status !== 'READY');
        if (allocations.length === 0 || notReady.length > 0) {
          throw new ConflictException({
            code: 'PACKING_ALLOCATION_BLOCKED',
            message: 'Every exact physical item must pass Ready Check before packing completes',
            blockers: [
              {
                code:
                  allocations.length === 0
                    ? 'PACKING_ALLOCATIONS_MISSING'
                    : 'READY_CHECK_INCOMPLETE',
                message:
                  allocations.length === 0
                    ? 'The fulfillment group has no exact physical-item allocations'
                    : 'One or more exact allocations have not passed Ready Check',
                count: allocations.length === 0 ? 0 : notReady.length,
              },
            ],
          });
        }

        const completedAt = new Date();
        await tx.fulfillment.updateMany({
          where: { tenantId: context.tenantId, groupId: context.groupId, status: 'PREPARING' },
          data: { status: 'READY', version: { increment: 1 } },
        });
        const updated = await tx.fulfillmentGroup.updateMany({
          where: {
            id: context.groupId,
            tenantId: context.tenantId,
            bookingId: context.bookingId,
            version: dto.expectedGroupVersion,
            status: 'PREPARING',
          },
          data: { status: 'READY', version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'STALE_FULFILLMENT_GROUP',
            message: 'This preparation group changed during packing. Reload before continuing.',
          });
        }
        await this.operationalEvents.append(
          {
            tenantId: context.tenantId,
            bookingId: context.bookingId,
            category: 'FULFILLMENT',
            eventType: 'OUTBOUND_GROUP_PACKED',
            aggregateType: 'FulfillmentGroup',
            aggregateId: context.groupId,
            actorUserId: context.actorUserId,
            reason: dto.reason?.trim() || 'All exact items passed Ready Check and were packed',
            metadata: {
              command: 'COMPLETE_PACKING',
              requestHash,
              groupId: context.groupId,
              bookingVersion: group.bookingVersion.version,
              allocationIds: allocations.map((allocation) => allocation.id),
              stockUnitIds: allocations.map((allocation) => allocation.stockUnitId),
            },
            idempotencyKey: context.idempotencyKey,
            occurredAt: completedAt,
          },
          tx,
        );
        return this.result(tx, context, false);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private result(tx: Prisma.TransactionClient, context: PackingContext, replayed: boolean) {
    return tx.fulfillmentGroup
      .findFirstOrThrow({
        where: {
          id: context.groupId,
          tenantId: context.tenantId,
          bookingId: context.bookingId,
        },
        include: {
          originLocation: true,
          fulfillments: {
            include: {
              allocations: {
                include: { stockUnit: { select: { id: true, assetCode: true } } },
                orderBy: [{ stockUnitId: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
      })
      .then((group) => ({ replayed, group }));
  }

  private object(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, Prisma.JsonValue>)
      : null;
  }
}
