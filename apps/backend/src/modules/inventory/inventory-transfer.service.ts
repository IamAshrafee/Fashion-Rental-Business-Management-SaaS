import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  InventoryTrackingMode,
  InventoryTransferLineKind,
  InventoryTransferStatus,
  InventoryTransferUnitOutcome,
  Prisma,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInventoryTransferDto,
  InventoryTransferActionDto,
  ReceiveInventoryTransferDto,
} from './dto/inventory-transfer.dto';
import { InventoryLocationService } from './inventory-location.service';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';

@Injectable()
export class InventoryTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: InventoryLocationService,
    private readonly lifecycle: StockUnitLifecycleService,
  ) {}

  async list(tenantId: string, status?: InventoryTransferStatus) {
    return this.prisma.inventoryTransfer.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: this.transferInclude(),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, transferId: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: this.transferInclude(),
    });
    if (!transfer) throw new NotFoundException('Inventory transfer not found');
    return transfer;
  }

  async create(tenantId: string, dto: CreateInventoryTransferDto, actorUserId: string) {
    if (dto.originLocationId === dto.destinationLocationId) {
      throw new BadRequestException('Transfer origin and destination must be different');
    }
    this.validateDates(dto.expectedDispatchAt, dto.expectedArrivalAt);
    this.validateDraftLines(dto);

    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.inventoryTransfer.findFirst({
          where: { tenantId, idempotencyKey: dto.idempotencyKey },
          include: this.transferInclude(),
        });
        if (existing) return existing;
      }
      await Promise.all([
        this.locations.getActiveOrThrow(
          tx,
          tenantId,
          dto.originLocationId,
          'canStoreInventory',
        ),
        this.locations.getActiveOrThrow(
          tx,
          tenantId,
          dto.destinationLocationId,
          'canStoreInventory',
        ),
      ]);

      const preparedLines = [] as Array<{
        lineKind: InventoryTransferLineKind;
        variantSizeId: string;
        inventoryPoolId: string | null;
        requestedQuantity: number;
        notes: string | null;
        stockUnitIds: string[];
      }>;
      const seenUnits = new Set<string>();
      for (const line of dto.lines) {
        const sku = await tx.variantSize.findFirst({
          where: { id: line.variantSizeId, tenantId },
          select: { id: true, trackingMode: true },
        });
        if (!sku) throw new NotFoundException('One or more transfer SKUs were not found');
        const expectedKind = sku.trackingMode === InventoryTrackingMode.POOLED
          ? InventoryTransferLineKind.POOLED
          : InventoryTransferLineKind.SERIALIZED;
        if (line.lineKind !== expectedKind) {
          throw new BadRequestException('Transfer line kind must match the SKU tracking mode');
        }

        if (line.lineKind === InventoryTransferLineKind.POOLED) {
          const pool = await tx.inventoryPool.findUnique({
            where: {
              variantSizeId_locationId: {
                variantSizeId: line.variantSizeId,
                locationId: dto.originLocationId,
              },
            },
          });
          if (!pool) throw new ConflictException('Origin location has no inventory pool for a selected SKU');
          preparedLines.push({
            lineKind: line.lineKind,
            variantSizeId: line.variantSizeId,
            inventoryPoolId: pool.id,
            requestedQuantity: line.quantity!,
            notes: line.notes?.trim() || null,
            stockUnitIds: [],
          });
          continue;
        }

        const stockUnitIds = line.stockUnitIds!;
        for (const id of stockUnitIds) {
          if (seenUnits.has(id)) throw new BadRequestException('A physical unit appears more than once');
          seenUnits.add(id);
        }
        const units = await tx.stockUnit.findMany({
          where: {
            id: { in: stockUnitIds },
            tenantId,
            variantSizeId: line.variantSizeId,
            locationId: dto.originLocationId,
            disposition: StockUnitDisposition.ACTIVE,
            operationalState: StockUnitOperationalState.AVAILABLE,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (units.length !== stockUnitIds.length) {
          throw new ConflictException('Every serialized unit must be available at the transfer origin');
        }
        preparedLines.push({
          lineKind: line.lineKind,
          variantSizeId: line.variantSizeId,
          inventoryPoolId: null,
          requestedQuantity: stockUnitIds.length,
          notes: line.notes?.trim() || null,
          stockUnitIds,
        });
      }

      const transfer = await tx.inventoryTransfer.create({
        data: {
          tenantId,
          transferNumber: this.transferNumber(),
          originLocationId: dto.originLocationId,
          destinationLocationId: dto.destinationLocationId,
          notes: dto.notes?.trim() || null,
          expectedDispatchAt: dto.expectedDispatchAt ? new Date(dto.expectedDispatchAt) : null,
          expectedArrivalAt: dto.expectedArrivalAt ? new Date(dto.expectedArrivalAt) : null,
          createdByUserId: actorUserId,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
      });
      for (const line of preparedLines) {
        await tx.inventoryTransferLine.create({
          data: {
            tenantId,
            transferId: transfer.id,
            lineKind: line.lineKind,
            variantSizeId: line.variantSizeId,
            inventoryPoolId: line.inventoryPoolId,
            requestedQuantity: line.requestedQuantity,
            notes: line.notes,
            ...(line.stockUnitIds.length
              ? {
                  units: {
                    create: line.stockUnitIds.map((stockUnitId) => ({ tenantId, stockUnitId })),
                  },
                }
              : {}),
          },
        });
      }
      await this.recordEvent(
        tx,
        tenantId,
        transfer.id,
        null,
        InventoryTransferStatus.DRAFT,
        'Transfer draft created',
        actorUserId,
        dto.idempotencyKey ? `event:create:${dto.idempotencyKey}` : undefined,
      );
      return tx.inventoryTransfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: this.transferInclude(),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async markReady(
    tenantId: string,
    transferId: string,
    dto: InventoryTransferActionDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const idempotent = await this.findIdempotentEvent(
        tx,
        tenantId,
        transferId,
        dto.idempotencyKey,
        [InventoryTransferStatus.READY],
      );
      if (idempotent) return this.getInTransaction(tx, tenantId, transferId);
      const transfer = await this.lockTransfer(tx, tenantId, transferId);
      if (transfer.status !== InventoryTransferStatus.DRAFT) {
        throw new ConflictException('Only a draft transfer can be approved');
      }

      for (const line of transfer.lines) {
        if (line.lineKind === InventoryTransferLineKind.POOLED) {
          if (!line.inventoryPoolId) throw new ConflictException('Pooled transfer line has no origin pool');
          await this.lockPool(tx, line.inventoryPoolId);
          const pool = await tx.inventoryPool.findFirst({
            where: { id: line.inventoryPoolId, tenantId, locationId: transfer.originLocationId },
          });
          if (!pool) throw new ConflictException('Origin inventory pool no longer exists');
          const [reservedForTransfers, peakReserved] = await Promise.all([
            tx.inventoryBlock.aggregate({
              where: {
                tenantId,
                inventoryPoolId: pool.id,
                blockType: 'TRANSFER',
                endDate: { gte: this.today() },
              },
              _sum: { quantity: true },
            }),
            this.getPeakReservedQuantity(
              tx,
              tenantId,
              line.variantSizeId,
              transfer.originLocationId,
            ),
          ]);
          const alreadyReserved = reservedForTransfers._sum.quantity ?? 0;
          if (pool.onHandQuantity - alreadyReserved - line.requestedQuantity < peakReserved) {
            throw new ConflictException({
              code: 'TRANSFER_CAPACITY_CONFLICT',
              message: 'This transfer would consume stock already required by rental reservations',
            });
          }
          await tx.inventoryBlock.create({
            data: {
              tenantId,
              variantSizeId: line.variantSizeId,
              locationId: transfer.originLocationId,
              inventoryPoolId: pool.id,
              transferLineId: line.id,
              quantity: line.requestedQuantity,
              startDate: this.today(),
              endDate: new Date('9999-12-31T00:00:00.000Z'),
              blockType: 'TRANSFER',
              reason: `Reserved for transfer ${transfer.transferNumber}`,
              createdByUserId: actorUserId,
            },
          });
          await this.createMovement(tx, {
            tenantId,
            variantSizeId: line.variantSizeId,
            inventoryPoolId: pool.id,
            originLocationId: transfer.originLocationId,
            destinationLocationId: transfer.destinationLocationId,
            transferId,
            transferLineId: line.id,
            movementType: InventoryMovementType.TRANSFER_RESERVED,
            quantityDelta: 0,
            reason: dto.reason,
            actorUserId,
          });
          continue;
        }
        await this.reserveSerializedLine(tx, tenantId, transfer, line, dto.reason, actorUserId);
      }

      await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: InventoryTransferStatus.READY,
          readyAt: new Date(),
          approvedByUserId: actorUserId,
          version: { increment: 1 },
        },
      });
      await this.recordEvent(
        tx,
        tenantId,
        transferId,
        transfer.status,
        InventoryTransferStatus.READY,
        dto.reason,
        actorUserId,
        dto.idempotencyKey,
      );
      return this.getInTransaction(tx, tenantId, transferId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async dispatch(
    tenantId: string,
    transferId: string,
    dto: InventoryTransferActionDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const idempotent = await this.findIdempotentEvent(
        tx,
        tenantId,
        transferId,
        dto.idempotencyKey,
        [InventoryTransferStatus.DISPATCHED],
      );
      if (idempotent) return this.getInTransaction(tx, tenantId, transferId);
      const transfer = await this.lockTransfer(tx, tenantId, transferId);
      if (transfer.status !== InventoryTransferStatus.READY) {
        throw new ConflictException('Only an approved transfer can be dispatched');
      }
      const now = new Date();
      for (const line of transfer.lines) {
        if (line.lineKind === InventoryTransferLineKind.POOLED) {
          if (!line.inventoryPoolId) throw new ConflictException('Pooled transfer line has no origin pool');
          await this.lockPool(tx, line.inventoryPoolId);
          const pool = await tx.inventoryPool.findUniqueOrThrow({ where: { id: line.inventoryPoolId } });
          if (pool.onHandQuantity < line.requestedQuantity) {
            throw new ConflictException('Origin pool no longer has the approved transfer quantity');
          }
          await tx.inventoryPool.update({
            where: { id: pool.id },
            data: { onHandQuantity: { decrement: line.requestedQuantity }, version: { increment: 1 } },
          });
          await tx.inventoryBlock.deleteMany({ where: { transferLineId: line.id, tenantId } });
          await tx.inventoryTransferLine.update({
            where: { id: line.id },
            data: { dispatchedQuantity: line.requestedQuantity },
          });
          await this.createMovement(tx, {
            tenantId,
            variantSizeId: line.variantSizeId,
            inventoryPoolId: pool.id,
            originLocationId: transfer.originLocationId,
            destinationLocationId: transfer.destinationLocationId,
            transferId,
            transferLineId: line.id,
            movementType: InventoryMovementType.TRANSFER_DISPATCHED,
            quantityDelta: -line.requestedQuantity,
            reason: dto.reason,
            actorUserId,
          });
          continue;
        }
        for (const unit of line.units) {
          await tx.inventoryTransferUnit.update({
            where: { id: unit.id },
            data: { dispatchedAt: now },
          });
          await this.createMovement(tx, {
            tenantId,
            variantSizeId: line.variantSizeId,
            stockUnitId: unit.stockUnitId,
            originLocationId: transfer.originLocationId,
            destinationLocationId: transfer.destinationLocationId,
            transferId,
            transferLineId: line.id,
            movementType: InventoryMovementType.TRANSFER_DISPATCHED,
            quantityDelta: 0,
            reason: dto.reason,
            actorUserId,
          });
        }
        await tx.inventoryTransferLine.update({
          where: { id: line.id },
          data: { dispatchedQuantity: line.units.length },
        });
      }
      await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: InventoryTransferStatus.DISPATCHED,
          dispatchedAt: now,
          dispatchedByUserId: actorUserId,
          version: { increment: 1 },
        },
      });
      await this.recordEvent(
        tx,
        tenantId,
        transferId,
        transfer.status,
        InventoryTransferStatus.DISPATCHED,
        dto.reason,
        actorUserId,
        dto.idempotencyKey,
      );
      return this.getInTransaction(tx, tenantId, transferId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async receive(
    tenantId: string,
    transferId: string,
    dto: ReceiveInventoryTransferDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const idempotent = await this.findIdempotentEvent(
        tx,
        tenantId,
        transferId,
        dto.idempotencyKey,
        [
          InventoryTransferStatus.PARTIALLY_RECEIVED,
          InventoryTransferStatus.RECEIVED,
          InventoryTransferStatus.RECONCILIATION_REQUIRED,
        ],
      );
      if (idempotent) return this.getInTransaction(tx, tenantId, transferId);
      const transfer = await this.lockTransfer(tx, tenantId, transferId);
      if (
        transfer.status !== InventoryTransferStatus.DISPATCHED &&
        transfer.status !== InventoryTransferStatus.PARTIALLY_RECEIVED
      ) {
        throw new ConflictException('Only dispatched inventory can be received');
      }
      const linesById = new Map(transfer.lines.map((line) => [line.id, line]));
      const submittedLineIds = new Set<string>();
      for (const input of dto.lines) {
        if (submittedLineIds.has(input.transferLineId)) {
          throw new BadRequestException('A transfer line can only appear once per receipt');
        }
        submittedLineIds.add(input.transferLineId);
        const line = linesById.get(input.transferLineId);
        if (!line) throw new BadRequestException('Receipt contains a line from another transfer');
        if (line.lineKind === InventoryTransferLineKind.POOLED) {
          await this.receivePooledLine(tx, tenantId, transfer, line, input, dto.reason, actorUserId);
        } else {
          await this.receiveSerializedLine(tx, tenantId, transfer, line, input, dto.reason, actorUserId);
        }
      }

      const refreshedLines = await tx.inventoryTransferLine.findMany({
        where: { tenantId, transferId },
      });
      const fullyAccounted = refreshedLines.every(
        (line) => line.receivedQuantity + line.damagedQuantity + line.lostQuantity === line.dispatchedQuantity,
      );
      const hasDiscrepancy = refreshedLines.some(
        (line) => line.damagedQuantity > 0 || line.lostQuantity > 0,
      );
      const nextStatus = !fullyAccounted
        ? InventoryTransferStatus.PARTIALLY_RECEIVED
        : hasDiscrepancy
          ? InventoryTransferStatus.RECONCILIATION_REQUIRED
          : InventoryTransferStatus.RECEIVED;
      await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: nextStatus,
          receivedByUserId: actorUserId,
          receivedAt: fullyAccounted ? new Date() : null,
          version: { increment: 1 },
        },
      });
      await this.recordEvent(
        tx,
        tenantId,
        transferId,
        transfer.status,
        nextStatus,
        dto.reason,
        actorUserId,
        dto.idempotencyKey,
      );
      return this.getInTransaction(tx, tenantId, transferId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancel(
    tenantId: string,
    transferId: string,
    dto: InventoryTransferActionDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const idempotent = await this.findIdempotentEvent(
        tx,
        tenantId,
        transferId,
        dto.idempotencyKey,
        [InventoryTransferStatus.CANCELLED],
      );
      if (idempotent) return this.getInTransaction(tx, tenantId, transferId);
      const transfer = await this.lockTransfer(tx, tenantId, transferId);
      if (
        transfer.status !== InventoryTransferStatus.DRAFT &&
        transfer.status !== InventoryTransferStatus.READY
      ) {
        throw new ConflictException('A dispatched or completed transfer cannot be cancelled');
      }
      if (transfer.status === InventoryTransferStatus.READY) {
        await tx.inventoryBlock.deleteMany({
          where: { tenantId, transferLineId: { in: transfer.lines.map((line) => line.id) } },
        });
        for (const line of transfer.lines.filter(
          (item) => item.lineKind === InventoryTransferLineKind.SERIALIZED,
        )) {
          for (const unit of line.units) {
            await this.lifecycle.transitionInTransaction(tx, {
              tenantId,
              stockUnitId: unit.stockUnitId,
              actorUserId,
              targetOperationalState: StockUnitOperationalState.AVAILABLE,
              reason: dto.reason,
              idempotencyKey: dto.idempotencyKey
                ? `transfer-cancel:${dto.idempotencyKey}:${unit.stockUnitId}`
                : undefined,
            });
            await this.createMovement(tx, {
              tenantId,
              variantSizeId: line.variantSizeId,
              stockUnitId: unit.stockUnitId,
              originLocationId: transfer.originLocationId,
              destinationLocationId: transfer.destinationLocationId,
              transferId,
              transferLineId: line.id,
              movementType: InventoryMovementType.TRANSFER_CANCELLED,
              quantityDelta: 0,
              reason: dto.reason,
              actorUserId,
            });
          }
        }
      }
      await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: InventoryTransferStatus.CANCELLED,
          cancellationReason: dto.reason.trim(),
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.recordEvent(
        tx,
        tenantId,
        transferId,
        transfer.status,
        InventoryTransferStatus.CANCELLED,
        dto.reason,
        actorUserId,
        dto.idempotencyKey,
      );
      return this.getInTransaction(tx, tenantId, transferId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reconcile(
    tenantId: string,
    transferId: string,
    dto: InventoryTransferActionDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const idempotent = await this.findIdempotentEvent(
        tx,
        tenantId,
        transferId,
        dto.idempotencyKey,
        [InventoryTransferStatus.RECONCILED],
      );
      if (idempotent) return this.getInTransaction(tx, tenantId, transferId);
      const transfer = await this.lockTransfer(tx, tenantId, transferId);
      if (transfer.status !== InventoryTransferStatus.RECONCILIATION_REQUIRED) {
        throw new ConflictException('Only a fully received transfer with exceptions can be reconciled');
      }
      const fullyAccounted = transfer.lines.every(
        (line) =>
          line.receivedQuantity + line.damagedQuantity + line.lostQuantity ===
          line.dispatchedQuantity,
      );
      const hasException = transfer.lines.some(
        (line) => line.damagedQuantity > 0 || line.lostQuantity > 0,
      );
      if (!fullyAccounted || !hasException) {
        throw new ConflictException('Transfer quantities are not ready for reconciliation');
      }
      await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: InventoryTransferStatus.RECONCILED,
          reconciliationReason: dto.reason.trim(),
          reconciledAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.recordEvent(
        tx,
        tenantId,
        transferId,
        transfer.status,
        InventoryTransferStatus.RECONCILED,
        dto.reason,
        actorUserId,
        dto.idempotencyKey,
      );
      return this.getInTransaction(tx, tenantId, transferId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async reserveSerializedLine(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transfer: Awaited<ReturnType<InventoryTransferService['lockTransfer']>>,
    line: (Awaited<ReturnType<InventoryTransferService['lockTransfer']>>)['lines'][number],
    reason: string,
    actorUserId: string,
  ) {
    const ids = line.units.map((unit) => unit.stockUnitId).sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM stock_units
      WHERE tenant_id = ${tenantId} AND id IN (${Prisma.join(ids)})
      ORDER BY id FOR UPDATE
    `);
    const validUnits = await tx.stockUnit.count({
      where: {
        tenantId,
        id: { in: ids },
        variantSizeId: line.variantSizeId,
        locationId: transfer.originLocationId,
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.AVAILABLE,
        condition: { not: 'DAMAGED' },
        deletedAt: null,
        assignments: {
          none: { releasedAt: null, blockedEndDate: { gte: this.today() } },
        },
        blocks: { none: { endDate: { gte: this.today() } } },
        issues: { none: { isAvailabilityBlocking: true, status: { in: ['OPEN', 'IN_SERVICE'] } } },
        componentStates: {
          none: {
            setComponentDefinition: { isActive: true, absenceBlocksRental: true },
            presence: { in: ['MISSING', 'DAMAGED'] },
          },
        },
      },
    });
    if (validUnits !== ids.length) {
      throw new ConflictException('One or more physical units are no longer eligible for transfer');
    }
    const [eligibleCapacity, peakReserved] = await Promise.all([
      tx.stockUnit.count({
        where: {
          tenantId,
          variantSizeId: line.variantSizeId,
          locationId: transfer.originLocationId,
          disposition: StockUnitDisposition.ACTIVE,
          operationalState: StockUnitOperationalState.AVAILABLE,
          condition: { not: 'DAMAGED' },
          deletedAt: null,
          issues: { none: { isAvailabilityBlocking: true, status: { in: ['OPEN', 'IN_SERVICE'] } } },
          componentStates: {
            none: {
              setComponentDefinition: { isActive: true, absenceBlocksRental: true },
              presence: { in: ['MISSING', 'DAMAGED'] },
            },
          },
          blocks: { none: { endDate: { gte: this.today() } } },
        },
      }),
      this.getPeakReservedQuantity(
        tx,
        tenantId,
        line.variantSizeId,
        transfer.originLocationId,
      ),
    ]);
    if (eligibleCapacity - ids.length < peakReserved) {
      throw new ConflictException({
        code: 'TRANSFER_CAPACITY_CONFLICT',
        message: 'This transfer would consume physical pieces required by rental reservations',
      });
    }
    for (const unit of line.units) {
      await this.lifecycle.transitionInTransaction(tx, {
        tenantId,
        stockUnitId: unit.stockUnitId,
        actorUserId,
        targetOperationalState: StockUnitOperationalState.IN_TRANSFER,
        reason,
      });
      await this.createMovement(tx, {
        tenantId,
        variantSizeId: line.variantSizeId,
        stockUnitId: unit.stockUnitId,
        originLocationId: transfer.originLocationId,
        destinationLocationId: transfer.destinationLocationId,
        transferId: transfer.id,
        transferLineId: line.id,
        movementType: InventoryMovementType.TRANSFER_RESERVED,
        quantityDelta: 0,
        reason,
        actorUserId,
      });
    }
  }

  private async receivePooledLine(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transfer: Awaited<ReturnType<InventoryTransferService['lockTransfer']>>,
    line: (Awaited<ReturnType<InventoryTransferService['lockTransfer']>>)['lines'][number],
    input: ReceiveInventoryTransferDto['lines'][number],
    reason: string,
    actorUserId: string,
  ) {
    if (input.units?.length) throw new BadRequestException('Pooled lines cannot receive unit outcomes');
    const received = input.receivedQuantity ?? 0;
    const damaged = input.damagedQuantity ?? 0;
    const lost = input.lostQuantity ?? 0;
    if (received + damaged + lost < 1) {
      throw new BadRequestException('A pooled receipt must account for at least one item');
    }
    const alreadyAccounted = line.receivedQuantity + line.damagedQuantity + line.lostQuantity;
    if (alreadyAccounted + received + damaged + lost > line.dispatchedQuantity) {
      throw new ConflictException('Receipt quantities exceed the dispatched quantity');
    }
    let destinationPoolId: string | null = null;
    if (received > 0) {
      const destinationPool = await tx.inventoryPool.upsert({
        where: {
          variantSizeId_locationId: {
            variantSizeId: line.variantSizeId,
            locationId: transfer.destinationLocationId,
          },
        },
        create: {
          tenantId,
          variantSizeId: line.variantSizeId,
          locationId: transfer.destinationLocationId,
          onHandQuantity: received,
          version: 1,
        },
        update: { onHandQuantity: { increment: received }, version: { increment: 1 } },
      });
      destinationPoolId = destinationPool.id;
      await this.createMovement(tx, {
        tenantId,
        variantSizeId: line.variantSizeId,
        inventoryPoolId: destinationPool.id,
        originLocationId: transfer.originLocationId,
        destinationLocationId: transfer.destinationLocationId,
        transferId: transfer.id,
        transferLineId: line.id,
        movementType: InventoryMovementType.TRANSFER_RECEIVED,
        quantityDelta: received,
        reason,
        actorUserId,
      });
    }
    await tx.inventoryTransferLine.update({
      where: { id: line.id },
      data: {
        receivedQuantity: { increment: received },
        damagedQuantity: { increment: damaged },
        lostQuantity: { increment: lost },
      },
    });
    if (damaged || lost) {
      await this.createMovement(tx, {
        tenantId,
        variantSizeId: line.variantSizeId,
        inventoryPoolId: destinationPoolId,
        originLocationId: transfer.originLocationId,
        destinationLocationId: transfer.destinationLocationId,
        transferId: transfer.id,
        transferLineId: line.id,
        movementType: InventoryMovementType.DAMAGE_WRITE_OFF,
        quantityDelta: 0,
        beforeState: this.json({ damaged, lost }),
        reason,
        actorUserId,
      });
    }
  }

  private async receiveSerializedLine(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transfer: Awaited<ReturnType<InventoryTransferService['lockTransfer']>>,
    line: (Awaited<ReturnType<InventoryTransferService['lockTransfer']>>)['lines'][number],
    input: ReceiveInventoryTransferDto['lines'][number],
    reason: string,
    actorUserId: string,
  ) {
    if (
      input.receivedQuantity !== undefined ||
      input.damagedQuantity !== undefined ||
      input.lostQuantity !== undefined
    ) {
      throw new BadRequestException('Serialized lines must report individual unit outcomes');
    }
    if (!input.units?.length) throw new BadRequestException('Serialized receipt requires unit outcomes');
    const transferUnits = new Map(line.units.map((unit) => [unit.stockUnitId, unit]));
    const seen = new Set<string>();
    let received = 0;
    let damaged = 0;
    let lost = 0;
    for (const result of input.units) {
      if (seen.has(result.stockUnitId)) throw new BadRequestException('A physical unit appears more than once');
      seen.add(result.stockUnitId);
      const transferUnit = transferUnits.get(result.stockUnitId);
      if (!transferUnit) throw new BadRequestException('Receipt contains a unit from another transfer line');
      if (transferUnit.outcome !== InventoryTransferUnitOutcome.PENDING) {
        throw new ConflictException('A physical unit has already been received');
      }
      if (result.outcome === InventoryTransferUnitOutcome.PENDING) {
        throw new BadRequestException('A receipt outcome cannot remain pending');
      }
      const next = this.serializedOutcome(result.outcome);
      if (result.outcome === InventoryTransferUnitOutcome.RECEIVED) received += 1;
      if (result.outcome === InventoryTransferUnitOutcome.DAMAGED) damaged += 1;
      if (result.outcome === InventoryTransferUnitOutcome.LOST) lost += 1;

      if (result.outcome !== InventoryTransferUnitOutcome.LOST) {
        await tx.stockUnit.update({
          where: { id: result.stockUnitId },
          data: { locationId: transfer.destinationLocationId },
        });
      }
      await this.lifecycle.transitionInTransaction(tx, {
        tenantId,
        stockUnitId: result.stockUnitId,
        actorUserId,
        targetDisposition: next.disposition,
        targetOperationalState: next.operationalState,
        reason,
      });
      await tx.inventoryTransferUnit.update({
        where: { id: transferUnit.id },
        data: { outcome: result.outcome, receivedAt: new Date(), notes: result.notes?.trim() || null },
      });
      await this.createMovement(tx, {
        tenantId,
        variantSizeId: line.variantSizeId,
        stockUnitId: result.stockUnitId,
        originLocationId: transfer.originLocationId,
        destinationLocationId: transfer.destinationLocationId,
        transferId: transfer.id,
        transferLineId: line.id,
        movementType: result.outcome === InventoryTransferUnitOutcome.RECEIVED
          ? InventoryMovementType.TRANSFER_RECEIVED
          : InventoryMovementType.DAMAGE_WRITE_OFF,
        quantityDelta: 0,
        afterState: this.json({ outcome: result.outcome }),
        reason,
        actorUserId,
      });
    }
    await tx.inventoryTransferLine.update({
      where: { id: line.id },
      data: {
        receivedQuantity: { increment: received },
        damagedQuantity: { increment: damaged },
        lostQuantity: { increment: lost },
      },
    });
  }

  private serializedOutcome(outcome: InventoryTransferUnitOutcome) {
    if (outcome === InventoryTransferUnitOutcome.RECEIVED) {
      return {
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.AVAILABLE,
      };
    }
    if (outcome === InventoryTransferUnitOutcome.DAMAGED) {
      return {
        disposition: StockUnitDisposition.QUARANTINED,
        operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      };
    }
    return {
      disposition: StockUnitDisposition.LOST,
      operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
    };
  }

  private async lockTransfer(tx: Prisma.TransactionClient, tenantId: string, transferId: string) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM inventory_transfers
      WHERE tenant_id = ${tenantId} AND id = ${transferId}
      FOR UPDATE
    `);
    const transfer = await tx.inventoryTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: { lines: { include: { units: true, inventoryPool: true } } },
    });
    if (!transfer) throw new NotFoundException('Inventory transfer not found');
    return transfer;
  }

  private lockPool(tx: Prisma.TransactionClient, poolId: string) {
    return tx.$queryRaw(Prisma.sql`SELECT id FROM inventory_pools WHERE id = ${poolId} FOR UPDATE`);
  }

  private getInTransaction(tx: Prisma.TransactionClient, tenantId: string, transferId: string) {
    return tx.inventoryTransfer.findFirstOrThrow({
      where: { id: transferId, tenantId },
      include: this.transferInclude(),
    });
  }

  private async findIdempotentEvent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transferId: string,
    idempotencyKey?: string,
    expectedStatuses: InventoryTransferStatus[] = [],
  ) {
    if (!idempotencyKey) return null;
    const event = await tx.inventoryTransferEvent.findFirst({ where: { tenantId, idempotencyKey } });
    if (
      event &&
      (event.transferId !== transferId || !expectedStatuses.includes(event.toStatus))
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The idempotency key belongs to another transfer action',
      });
    }
    return event;
  }

  private recordEvent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transferId: string,
    fromStatus: InventoryTransferStatus | null,
    toStatus: InventoryTransferStatus,
    reason: string,
    actorUserId: string,
    idempotencyKey?: string,
  ) {
    return tx.inventoryTransferEvent.create({
      data: {
        tenantId,
        transferId,
        fromStatus,
        toStatus,
        reason: reason.trim(),
        actorUserId,
        idempotencyKey: idempotencyKey ?? null,
      },
    });
  }

  private createMovement(
    tx: Prisma.TransactionClient,
    data: Prisma.InventoryMovementUncheckedCreateInput,
  ) {
    return tx.inventoryMovement.create({ data });
  }

  private async getPeakReservedQuantity(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
    locationId: string,
  ) {
    const now = new Date();
    const reservations = await tx.inventoryReservation.findMany({
      where: {
        tenantId,
        variantSizeId,
        sourceLocationId: locationId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        blockedEndDate: { gte: this.today() },
        OR: [
          { status: 'CONFIRMED' },
          { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: { blockedStartDate: true, blockedEndDate: true, quantity: true },
    });
    const events = reservations.flatMap((reservation) => [
      { at: reservation.blockedStartDate.getTime(), delta: reservation.quantity },
      { at: reservation.blockedEndDate.getTime() + 86_400_000, delta: -reservation.quantity },
    ]).sort((left, right) => left.at - right.at || left.delta - right.delta);
    let current = 0;
    let peak = 0;
    for (const event of events) {
      current += event.delta;
      peak = Math.max(peak, current);
    }
    return peak;
  }

  private validateDraftLines(dto: CreateInventoryTransferDto) {
    const keys = new Set<string>();
    for (const line of dto.lines) {
      const key = `${line.variantSizeId}:${line.lineKind}`;
      if (keys.has(key)) throw new BadRequestException('Duplicate transfer line for the same SKU');
      keys.add(key);
      if (line.lineKind === InventoryTransferLineKind.POOLED) {
        if (!line.quantity || line.stockUnitIds?.length) {
          throw new BadRequestException('Pooled lines require quantity and cannot include physical units');
        }
      } else if (!line.stockUnitIds?.length || line.quantity !== undefined) {
        throw new BadRequestException('Serialized lines require physical unit IDs and no quantity');
      }
    }
  }

  private validateDates(dispatch?: string, arrival?: string) {
    if (!dispatch || !arrival) return;
    if (new Date(dispatch) > new Date(arrival)) {
      throw new BadRequestException('Expected dispatch must be before expected arrival');
    }
  }

  private transferNumber() {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `TRF-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private today() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private transferInclude() {
    return {
      originLocation: { select: { id: true, code: true, name: true } },
      destinationLocation: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
      approvedBy: { select: { id: true, fullName: true } },
      dispatchedBy: { select: { id: true, fullName: true } },
      receivedBy: { select: { id: true, fullName: true } },
      lines: {
        include: {
          variantSize: {
            include: {
              sizeInstance: true,
              variant: { include: { product: { select: { id: true, name: true } } } },
            },
          },
          units: { include: { stockUnit: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      events: {
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.InventoryTransferInclude;
  }
}
