import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, InventoryTrackingMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdjustInventoryPoolDto,
  CountInventoryPoolDto,
} from './dto/inventory-foundation.dto';
import { InventoryLocationService } from './inventory-location.service';

@Injectable()
export class InventoryPoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: InventoryLocationService,
  ) {}

  async listForSku(tenantId: string, variantSizeId: string) {
    await this.getPooledSku(this.prisma, tenantId, variantSizeId);
    return this.prisma.inventoryPool.findMany({
      where: { tenantId, variantSizeId },
      include: { location: true },
      orderBy: [{ location: { isDefault: 'desc' } }, { location: { name: 'asc' } }],
    });
  }

  async adjust(
    tenantId: string,
    variantSizeId: string,
    dto: AdjustInventoryPoolDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.getPooledSku(tx, tenantId, variantSizeId);
      await this.locations.getActiveOrThrow(tx, tenantId, dto.locationId, 'canStoreInventory');

      const current = await this.getOrCreateLockedPool(
        tx,
        tenantId,
        variantSizeId,
        dto.locationId,
      );
      this.assertVersion(current.version, dto.expectedVersion);
      const direction = dto.adjustmentType === 'RECEIVE' || dto.adjustmentType === 'ADD' ? 1 : -1;
      const quantityDelta = direction * dto.quantity;
      const nextQuantity = current.onHandQuantity + quantityDelta;
      if (nextQuantity < 0) {
        throw new ConflictException({
          code: 'POOL_INSUFFICIENT_ON_HAND',
          currentQuantity: current.onHandQuantity,
          requestedReduction: dto.quantity,
          message: 'This adjustment would make on-hand stock negative.',
        });
      }
      if (quantityDelta < 0) {
        const peakReserved = await this.getPeakReservedQuantity(
          tx,
          tenantId,
          variantSizeId,
          dto.locationId,
        );
        if (nextQuantity < peakReserved) {
          throw new ConflictException({
            code: 'POOL_QUANTITY_BELOW_RESERVED_CAPACITY',
            currentQuantity: current.onHandQuantity,
            resultingQuantity: nextQuantity,
            peakReserved,
            message: `On-hand quantity cannot be lower than peak reserved demand (${peakReserved})`,
          });
        }
      }

      const pool = await tx.inventoryPool.update({
        where: { id: current.id },
        data: {
          onHandQuantity: nextQuantity,
          ...(dto.reorderThreshold !== undefined
            ? { reorderThreshold: dto.reorderThreshold }
            : {}),
          version: { increment: 1 },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId,
          variantSizeId,
          inventoryPoolId: pool.id,
          destinationLocationId: quantityDelta > 0 ? dto.locationId : null,
          originLocationId: quantityDelta < 0 ? dto.locationId : null,
          movementType: this.movementTypeFor(dto.adjustmentType),
          quantityDelta,
          beforeState: this.json({
            onHandQuantity: current.onHandQuantity,
            version: current.version,
          }),
          afterState: this.json({
            onHandQuantity: nextQuantity,
            version: pool.version,
            adjustmentType: dto.adjustmentType,
          }),
          reason: dto.reason.trim(),
          actorUserId: actorUserId ?? null,
        },
      });
      return { pool, movement };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async count(
    tenantId: string,
    variantSizeId: string,
    dto: CountInventoryPoolDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.getPooledSku(tx, tenantId, variantSizeId);
      await this.locations.getActiveOrThrow(tx, tenantId, dto.locationId, 'canStoreInventory');
      const current = await this.getOrCreateLockedPool(
        tx,
        tenantId,
        variantSizeId,
        dto.locationId,
      );
      this.assertVersion(current.version, dto.expectedVersion);

      const peakReserved = await this.getPeakReservedQuantity(
        tx,
        tenantId,
        variantSizeId,
        dto.locationId,
      );
      if (dto.observedQuantity < peakReserved) {
        throw new ConflictException({
          code: 'POOL_COUNT_BELOW_RESERVED_CAPACITY',
          expectedQuantity: current.onHandQuantity,
          observedQuantity: dto.observedQuantity,
          peakReserved,
          message: `The observed quantity cannot cover peak reserved demand (${peakReserved}). Resolve the reservations before reconciling this count.`,
        });
      }

      const variance = dto.observedQuantity - current.onHandQuantity;
      const pool = await tx.inventoryPool.update({
        where: { id: current.id },
        data: {
          onHandQuantity: dto.observedQuantity,
          version: { increment: 1 },
        },
      });
      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId,
          variantSizeId,
          inventoryPoolId: pool.id,
          originLocationId: variance < 0 ? dto.locationId : null,
          destinationLocationId: variance > 0 ? dto.locationId : null,
          movementType: InventoryMovementType.COUNT_CORRECTION,
          quantityDelta: variance,
          beforeState: this.json({
            expectedQuantity: current.onHandQuantity,
            version: current.version,
          }),
          afterState: this.json({
            observedQuantity: dto.observedQuantity,
            variance,
            version: pool.version,
          }),
          reason: dto.reason.trim(),
          actorUserId: actorUserId ?? null,
        },
      });
      return { pool, count: movement };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async getOrCreateLockedPool(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
    locationId: string,
  ) {
    await tx.inventoryPool.upsert({
      where: { variantSizeId_locationId: { variantSizeId, locationId } },
      create: { tenantId, variantSizeId, locationId, onHandQuantity: 0, version: 0 },
      update: {},
    });
    await tx.$queryRaw`
      SELECT id FROM inventory_pools
      WHERE tenant_id = ${tenantId}
        AND variant_size_id = ${variantSizeId}
        AND location_id = ${locationId}
      FOR UPDATE
    `;
    return tx.inventoryPool.findUniqueOrThrow({
      where: { variantSizeId_locationId: { variantSizeId, locationId } },
    });
  }

  private assertVersion(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) {
      throw new ConflictException({
        code: 'STALE_INVENTORY_POOL',
        currentVersion,
        expectedVersion,
        message: 'This stock pool changed after it was loaded. Refresh and review the new quantity.',
      });
    }
  }

  private movementTypeFor(adjustmentType: AdjustInventoryPoolDto['adjustmentType']) {
    if (adjustmentType === 'WRITE_OFF') return InventoryMovementType.DAMAGE_WRITE_OFF;
    if (adjustmentType === 'SUBTRACT') return InventoryMovementType.POOLED_REDUCTION;
    return InventoryMovementType.POOLED_ADDITION;
  }

  private async getPooledSku(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    variantSizeId: string,
  ) {
    const sku = await db.variantSize.findFirst({
      where: { id: variantSizeId, tenantId },
      select: { id: true, trackingMode: true },
    });
    if (!sku) throw new NotFoundException('Variant-size inventory was not found');
    if (sku.trackingMode !== InventoryTrackingMode.POOLED) {
      throw new ConflictException('Inventory pools are only valid for pooled SKUs');
    }
    return sku;
  }

  private async getPeakReservedQuantity(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
    locationId: string,
  ) {
    const reservations = await tx.inventoryReservation.findMany({
      where: {
        tenantId,
        variantSizeId,
        sourceLocationId: locationId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        blockedEndDate: { gte: new Date() },
        OR: [
          { status: 'CONFIRMED' },
          { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      select: { blockedStartDate: true, blockedEndDate: true, quantity: true },
    });
    const events = reservations.flatMap((reservation) => [
      { at: reservation.blockedStartDate.getTime(), delta: reservation.quantity },
      { at: reservation.blockedEndDate.getTime() + 86_400_000, delta: -reservation.quantity },
    ]);
    events.sort((left, right) => left.at - right.at || left.delta - right.delta);
    let current = 0;
    let peak = 0;
    for (const event of events) {
      current += event.delta;
      peak = Math.max(peak, current);
    }
    return peak;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
