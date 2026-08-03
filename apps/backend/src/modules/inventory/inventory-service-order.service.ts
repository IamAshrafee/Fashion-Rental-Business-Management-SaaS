import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryServiceOrderStatus,
  InventoryServiceOrderType,
  Prisma,
  StockUnitIssueStatus,
  StockUnitOperationalState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CancelInventoryServiceOrderDto,
  CompleteInventoryServiceOrderDto,
  CreateInventoryServiceOrderDto,
  StartInventoryServiceOrderDto,
} from './dto/inventory-operations.dto';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';

const OPEN_SERVICE_STATUSES: InventoryServiceOrderStatus[] = [
  InventoryServiceOrderStatus.REQUESTED,
  InventoryServiceOrderStatus.SCHEDULED,
  InventoryServiceOrderStatus.IN_PROGRESS,
];

const STARTABLE_SERVICE_STATUSES = new Set<InventoryServiceOrderStatus>([
  InventoryServiceOrderStatus.REQUESTED,
  InventoryServiceOrderStatus.SCHEDULED,
]);

const DIRECT_AVAILABILITY_SERVICE_TYPES = new Set<InventoryServiceOrderType>([
  InventoryServiceOrderType.PREPARATION,
  InventoryServiceOrderType.CLEANING,
  InventoryServiceOrderType.WASHING,
]);

@Injectable()
export class InventoryServiceOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: StockUnitLifecycleService,
  ) {}

  async create(
    tenantId: string,
    stockUnitId: string,
    dto: CreateInventoryServiceOrderDto,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.idempotencyKey) {
          const existing = await tx.inventoryServiceOrder.findFirst({
            where: { tenantId, createIdempotencyKey: dto.idempotencyKey },
            include: this.orderInclude(),
          });
          if (existing) {
            if (existing.stockUnitId !== stockUnitId || existing.serviceType !== dto.serviceType) {
              throw new ConflictException({
                code: 'IDEMPOTENCY_KEY_REUSED',
                message: 'The idempotency key belongs to another service order',
              });
            }
            return existing;
          }
        }

        const unit = await tx.stockUnit.findFirst({
          where: { id: stockUnitId, tenantId, deletedAt: null },
        });
        if (!unit) throw new NotFoundException('Stock unit not found');
        if (unit.disposition === 'RETIRED' || unit.disposition === 'LOST') {
          throw new ConflictException('Lost or retired units cannot start service work');
        }

        await this.validateContext(tx, tenantId, stockUnitId, dto);
        const scheduledStartAt = dto.scheduledStartAt
          ? new Date(dto.scheduledStartAt)
          : null;
        const expectedCompletionAt = dto.expectedCompletionAt
          ? new Date(dto.expectedCompletionAt)
          : null;
        if (
          scheduledStartAt &&
          expectedCompletionAt &&
          scheduledStartAt > expectedCompletionAt
        ) {
          throw new BadRequestException('Service start must be before expected completion');
        }

        let inventoryBlockId: string | null = null;
        if (dto.isAvailabilityBlocking !== false) {
          const block = await tx.inventoryBlock.create({
            data: {
              tenantId,
              stockUnitId,
              startDate: this.toDateOnly(scheduledStartAt ?? new Date()),
              endDate: this.toDateOnly(expectedCompletionAt ?? new Date('9999-12-31T00:00:00.000Z')),
              blockType: 'MAINTENANCE',
              reason: `${dto.serviceType.toLowerCase()} service order`,
              createdByUserId: actorUserId,
            },
          });
          inventoryBlockId = block.id;
        }

        const status = scheduledStartAt
          ? InventoryServiceOrderStatus.SCHEDULED
          : InventoryServiceOrderStatus.REQUESTED;
        const order = await tx.inventoryServiceOrder.create({
          data: {
            tenantId,
            stockUnitId,
            issueId: dto.issueId ?? null,
            sourceInspectionId: dto.sourceInspectionId ?? null,
            inventoryBlockId,
            serviceType: dto.serviceType,
            status,
            isAvailabilityBlocking: dto.isAvailabilityBlocking !== false,
            providerName: dto.providerName?.trim() || null,
            locationLabel: dto.locationLabel?.trim() || null,
            requestedByUserId: actorUserId,
            scheduledStartAt,
            expectedCompletionAt,
            cost: dto.cost ?? null,
            notes: dto.notes?.trim() || null,
            createIdempotencyKey: dto.idempotencyKey ?? null,
          },
          include: this.orderInclude(),
        });

        if (dto.issueId) {
          await tx.stockUnitIssue.update({
            where: { id: dto.issueId },
            data: { status: 'IN_SERVICE' },
          });
        }
        return order;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowServiceConflict(error);
    }
  }

  async start(
    tenantId: string,
    serviceOrderId: string,
    dto: StartInventoryServiceOrderDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, tenantId, serviceOrderId);
      const order = await tx.inventoryServiceOrder.findFirst({
        where: { id: serviceOrderId, tenantId },
      });
      if (!order) throw new NotFoundException('Service order not found');
      if (order.status === InventoryServiceOrderStatus.IN_PROGRESS) return order;
      if (!STARTABLE_SERVICE_STATUSES.has(order.status)) {
        throw new ConflictException({
          code: 'SERVICE_ORDER_STATE_INVALID',
          message: 'Only requested or scheduled service work can be started',
        });
      }

      const updated = await tx.inventoryServiceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: InventoryServiceOrderStatus.IN_PROGRESS,
          startedAt: new Date(),
          notes: dto.note?.trim()
            ? [order.notes, dto.note.trim()].filter(Boolean).join('\n')
            : order.notes,
        },
      });

      await this.lifecycle.transitionInTransaction(tx, {
        tenantId,
        stockUnitId: order.stockUnitId,
        actorUserId,
        reason: `Started ${order.serviceType.toLowerCase()} service`,
        targetOperationalState: this.operationalStateFor(order.serviceType),
        serviceOrderId,
        idempotencyKey: dto.idempotencyKey,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async complete(
    tenantId: string,
    serviceOrderId: string,
    dto: CompleteInventoryServiceOrderDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.inventoryServiceOrder.findFirst({
          where: { tenantId, completionIdempotencyKey: dto.idempotencyKey },
          include: this.orderInclude(),
        });
        if (existing) {
          if (existing.id !== serviceOrderId) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'The idempotency key belongs to another service completion',
            });
          }
          return existing;
        }
      }

      await this.lockOrder(tx, tenantId, serviceOrderId);
      const order = await tx.inventoryServiceOrder.findFirst({
        where: { id: serviceOrderId, tenantId },
      });
      if (!order) throw new NotFoundException('Service order not found');
      if (!OPEN_SERVICE_STATUSES.includes(order.status)) {
        throw new ConflictException({
          code: 'SERVICE_ORDER_STATE_INVALID',
          message: 'This service order is no longer active',
        });
      }
      if (
        dto.requiresInspection === false &&
        !DIRECT_AVAILABILITY_SERVICE_TYPES.has(order.serviceType)
      ) {
        throw new ConflictException({
          code: 'INSPECTION_REQUIRED',
          message: 'Repair, alteration, and maintenance work require a completion inspection',
        });
      }

      await tx.inventoryServiceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: InventoryServiceOrderStatus.COMPLETED,
          completedAt: new Date(),
          completedByUserId: actorUserId,
          completionOutcome: dto.completionOutcome.trim(),
          cost: dto.cost ?? order.cost,
          completionIdempotencyKey: dto.idempotencyKey ?? null,
        },
      });

      if (order.inventoryBlockId && dto.requiresInspection === false) {
        await tx.inventoryBlock.deleteMany({
          where: { id: order.inventoryBlockId, tenantId },
        });
      } else if (order.inventoryBlockId) {
        const block = await tx.inventoryBlock.findFirst({
          where: { id: order.inventoryBlockId, tenantId },
        });
        if (block) {
          await tx.inventoryBlock.update({
            where: { id: block.id },
            data: {
              reason: `${block.reason ?? 'Service'}; awaiting completion inspection`,
              endDate: new Date('9999-12-31T00:00:00.000Z'),
            },
          });
        }
      }

      if (dto.conditionAfter) {
        await tx.stockUnit.update({
          where: { id: order.stockUnitId },
          data: { condition: dto.conditionAfter },
        });
      }

      await this.lifecycle.transitionInTransaction(tx, {
        tenantId,
        stockUnitId: order.stockUnitId,
        actorUserId,
        reason: dto.completionOutcome.trim(),
        targetOperationalState:
          dto.requiresInspection === false
            ? StockUnitOperationalState.AVAILABLE
            : StockUnitOperationalState.AWAITING_INSPECTION,
        serviceOrderId,
        idempotencyKey: dto.idempotencyKey
          ? `service-lifecycle:${dto.idempotencyKey}`
          : undefined,
      });

      return tx.inventoryServiceOrder.findUniqueOrThrow({
        where: { id: serviceOrderId },
        include: this.orderInclude(),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancel(
    tenantId: string,
    serviceOrderId: string,
    dto: CancelInventoryServiceOrderDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, tenantId, serviceOrderId);
      const order = await tx.inventoryServiceOrder.findFirst({
        where: { id: serviceOrderId, tenantId },
      });
      if (!order) throw new NotFoundException('Service order not found');
      if (order.status === InventoryServiceOrderStatus.CANCELLED) return order;
      if (!OPEN_SERVICE_STATUSES.includes(order.status)) {
        throw new ConflictException({
          code: 'SERVICE_ORDER_STATE_INVALID',
          message: 'Only active service work can be cancelled',
        });
      }

      const wasInProgress = order.status === InventoryServiceOrderStatus.IN_PROGRESS;
      const updated = await tx.inventoryServiceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: InventoryServiceOrderStatus.CANCELLED,
          notes: [order.notes, `Cancelled: ${dto.reason.trim()}`].filter(Boolean).join('\n'),
        },
      });
      if (order.inventoryBlockId) {
        await tx.inventoryBlock.deleteMany({ where: { id: order.inventoryBlockId, tenantId } });
      }
      if (order.issueId) {
        await tx.stockUnitIssue.updateMany({
          where: { id: order.issueId, tenantId, status: StockUnitIssueStatus.IN_SERVICE },
          data: { status: StockUnitIssueStatus.OPEN },
        });
      }
      if (wasInProgress) {
        await this.lifecycle.transitionInTransaction(tx, {
          tenantId,
          stockUnitId: order.stockUnitId,
          actorUserId,
          reason: `Service cancelled: ${dto.reason.trim()}`,
          targetOperationalState: StockUnitOperationalState.AWAITING_INSPECTION,
          serviceOrderId,
          idempotencyKey: dto.idempotencyKey,
        });
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listForUnit(tenantId: string, stockUnitId: string) {
    const unit = await this.prisma.stockUnit.findFirst({
      where: { id: stockUnitId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Stock unit not found');
    return this.prisma.inventoryServiceOrder.findMany({
      where: { tenantId, stockUnitId },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  private async validateContext(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stockUnitId: string,
    dto: CreateInventoryServiceOrderDto,
  ): Promise<void> {
    if (dto.issueId) {
      const issue = await tx.stockUnitIssue.findFirst({
        where: { id: dto.issueId, tenantId, stockUnitId },
        select: { id: true, status: true },
      });
      if (!issue) throw new NotFoundException('Stock-unit issue not found');
      if (!['OPEN', 'IN_SERVICE'].includes(issue.status)) {
        throw new ConflictException('Resolved issues cannot start new service work');
      }
    }
    if (dto.sourceInspectionId) {
      const inspection = await tx.stockUnitInspection.findFirst({
        where: { id: dto.sourceInspectionId, tenantId, stockUnitId },
        select: { id: true },
      });
      if (!inspection) throw new NotFoundException('Source inspection not found');
    }
  }

  private async lockOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceOrderId: string,
  ): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM inventory_service_orders
      WHERE tenant_id = ${tenantId} AND id = ${serviceOrderId}
      FOR UPDATE
    `);
  }

  private operationalStateFor(type: InventoryServiceOrderType): StockUnitOperationalState {
    const states: Record<InventoryServiceOrderType, StockUnitOperationalState> = {
      PREPARATION: StockUnitOperationalState.PREPARING,
      CLEANING: StockUnitOperationalState.CLEANING,
      WASHING: StockUnitOperationalState.WASHING,
      REPAIR: StockUnitOperationalState.REPAIRING,
      ALTERATION: StockUnitOperationalState.REPAIRING,
      MAINTENANCE: StockUnitOperationalState.REPAIRING,
    };
    return states[type];
  }

  private orderInclude() {
    return {
      issue: true,
      sourceInspection: { select: { id: true, inspectionType: true, completedAt: true } },
      inventoryBlock: true,
      requestedBy: { select: { id: true, fullName: true } },
      completedBy: { select: { id: true, fullName: true } },
      mediaAttachments: true,
    } satisfies Prisma.InventoryServiceOrderInclude;
  }

  private rethrowServiceConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: 'SERVICE_ORDER_CONFLICT',
        message: 'Another blocking service workflow is already active for this unit',
      });
    }
    throw error;
  }

  private toDateOnly(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
