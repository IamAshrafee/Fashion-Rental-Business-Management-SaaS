import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, InventoryTrackingMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SetInventoryPoolQuantityDto } from './dto/inventory-foundation.dto';
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

  async setQuantity(
    tenantId: string,
    variantSizeId: string,
    dto: SetInventoryPoolQuantityDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.getPooledSku(tx, tenantId, variantSizeId);
      await this.locations.getActiveOrThrow(tx, tenantId, dto.locationId, 'canStoreInventory');

      const current = await tx.inventoryPool.findUnique({
        where: { variantSizeId_locationId: { variantSizeId, locationId: dto.locationId } },
      });
      const beforeQuantity = current?.onHandQuantity ?? 0;
      if (dto.onHandQuantity < beforeQuantity) {
        const peakReserved = await this.getPeakReservedQuantity(
          tx,
          tenantId,
          variantSizeId,
          dto.locationId,
        );
        if (dto.onHandQuantity < peakReserved) {
          throw new ConflictException({
            code: 'POOL_QUANTITY_BELOW_RESERVED_CAPACITY',
            message: `On-hand quantity cannot be lower than peak reserved demand (${peakReserved})`,
          });
        }
      }

      const pool = await tx.inventoryPool.upsert({
        where: { variantSizeId_locationId: { variantSizeId, locationId: dto.locationId } },
        create: {
          tenantId,
          variantSizeId,
          locationId: dto.locationId,
          onHandQuantity: dto.onHandQuantity,
          reorderThreshold: dto.reorderThreshold ?? null,
          version: 1,
        },
        update: {
          onHandQuantity: dto.onHandQuantity,
          ...(dto.reorderThreshold !== undefined
            ? { reorderThreshold: dto.reorderThreshold }
            : {}),
          version: { increment: 1 },
        },
      });

      const quantityDelta = dto.onHandQuantity - beforeQuantity;
      if (quantityDelta !== 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantSizeId,
            inventoryPoolId: pool.id,
            destinationLocationId: quantityDelta > 0 ? dto.locationId : null,
            originLocationId: quantityDelta < 0 ? dto.locationId : null,
            movementType:
              quantityDelta > 0
                ? InventoryMovementType.POOLED_ADDITION
                : InventoryMovementType.POOLED_REDUCTION,
            quantityDelta,
            beforeState: this.json({ onHandQuantity: beforeQuantity }),
            afterState: this.json({ onHandQuantity: dto.onHandQuantity }),
            reason: dto.reason.trim(),
            actorUserId: actorUserId ?? null,
          },
        });
      }
      return pool;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
