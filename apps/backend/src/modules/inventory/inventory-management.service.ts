import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  InventoryTrackingMode,
  Prisma,
  StockConditionGrade,
  StockUnitDisposition,
  StockUnitOperationalState,
  StockUnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConfigureVariantSizeInventoryDto,
  CreateInventoryBlockDto,
  CreateStockUnitDto,
  InventoryCalendarQueryDto,
  UpdateStockUnitDto,
} from './dto/inventory.dto';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';

@Injectable()
export class InventoryManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: StockUnitLifecycleService,
  ) {}

  async getProductInventory(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        isAvailable: true,
        variants: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            variantName: true,
            mainColor: { select: { id: true, name: true, hexCode: true } },
            sizes: {
              select: {
                id: true,
                trackingMode: true,
                pooledQuantity: true,
                inventoryVersion: true,
                sizeInstance: {
                  select: {
                    id: true,
                    displayLabel: true,
                    normalizedKey: true,
                    sortOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    const today = this.startOfToday();
    const variants = await Promise.all(
      product.variants.map(async (variant) => ({
        ...variant,
        sizes: await Promise.all(
          variant.sizes
            .sort((left, right) => left.sizeInstance.sortOrder - right.sizeInstance.sortOrder)
            .map(async (sku) => {
              const [unitCounts, reservationAggregate] = await Promise.all([
                this.prisma.stockUnit.groupBy({
                  by: ['status'],
                  where: { tenantId, variantSizeId: sku.id, deletedAt: null },
                  _count: { _all: true },
                }),
                this.prisma.inventoryReservation.aggregate({
                  where: {
                    tenantId,
                    variantSizeId: sku.id,
                    status: { in: ['PENDING', 'CONFIRMED'] },
                    blockedStartDate: { lte: today },
                    blockedEndDate: { gte: today },
                    OR: [
                      { status: 'CONFIRMED' },
                      { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                    ],
                  },
                  _sum: { quantity: true },
                }),
              ]);

              const counts = Object.fromEntries(
                unitCounts.map((entry) => [entry.status, entry._count._all]),
              ) as Partial<Record<StockUnitStatus, number>>;
              const activeUnits = counts.ACTIVE ?? 0;
              const reservedQuantity = reservationAggregate._sum.quantity ?? 0;
              const totalCapacity =
                sku.trackingMode === InventoryTrackingMode.POOLED
                  ? sku.pooledQuantity
                  : activeUnits;

              return {
                variantSizeId: sku.id,
                sizeInstance: sku.sizeInstance,
                trackingMode: sku.trackingMode,
                pooledQuantity: sku.pooledQuantity,
                inventoryVersion: sku.inventoryVersion,
                totalCapacity,
                reservedQuantity,
                availableQuantity: Math.max(0, totalCapacity - reservedQuantity),
                unitCounts: {
                  active: activeUnits,
                  maintenance: counts.MAINTENANCE ?? 0,
                  retired: counts.RETIRED ?? 0,
                  lost: counts.LOST ?? 0,
                },
              };
            }),
        ),
      })),
    );

    return { ...product, variants };
  }

  async configureVariantSize(
    tenantId: string,
    variantSizeId: string,
    dto: ConfigureVariantSizeInventoryDto,
    actorUserId?: string,
  ) {
    if (dto.trackingMode === undefined && dto.pooledQuantity === undefined) {
      throw new BadRequestException('Provide trackingMode or pooledQuantity');
    }

    return this.prisma.$transaction(async (tx) => {
      const sku = await this.getVariantSize(tx, tenantId, variantSizeId);
      const nextMode = dto.trackingMode ?? sku.trackingMode;
      const nextQuantity = dto.pooledQuantity ?? sku.pooledQuantity;

      if (nextMode !== sku.trackingMode) {
        const activeReservations = await tx.inventoryReservation.count({
          where: {
            tenantId,
            variantSizeId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            blockedEndDate: { gte: this.startOfToday() },
          },
        });
        if (activeReservations > 0) {
          throw new ConflictException({
            code: 'INVALID_TRACKING_MODE_CHANGE',
            message: 'Tracking mode cannot change while active or future reservations exist',
          });
        }

        if (nextMode === InventoryTrackingMode.POOLED) {
          const activeUnits = await tx.stockUnit.count({
            where: {
              tenantId,
              variantSizeId,
              status: { in: ['ACTIVE', 'MAINTENANCE'] },
              deletedAt: null,
            },
          });
          if (activeUnits > 0) {
            throw new ConflictException({
              code: 'INVALID_TRACKING_MODE_CHANGE',
              message: 'Retire active physical units before switching this SKU to pooled inventory',
            });
          }
        }
      }

      if (nextMode === InventoryTrackingMode.POOLED) {
        const peakReserved = await this.getPeakReservedQuantity(tx, tenantId, variantSizeId);
        if (nextQuantity < peakReserved) {
          throw new ConflictException({
            code: 'QUANTITY_BELOW_RESERVED_CAPACITY',
            message: `Quantity cannot be lower than peak reserved demand (${peakReserved})`,
          });
        }
      }

      const updated = await tx.variantSize.update({
        where: { id: variantSizeId },
        data: {
          trackingMode: nextMode,
          pooledQuantity: nextQuantity,
          stockLevel: nextQuantity,
          inventoryVersion: { increment: 1 },
        },
        include: { sizeInstance: true },
      });

      if (nextQuantity !== sku.pooledQuantity || nextMode !== sku.trackingMode) {
        const quantityDelta = nextQuantity - sku.pooledQuantity;
        const movementType =
          quantityDelta > 0
            ? InventoryMovementType.POOLED_ADDITION
            : quantityDelta < 0
              ? InventoryMovementType.POOLED_REDUCTION
              : InventoryMovementType.ADMIN_CORRECTION;

        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantSizeId,
            movementType,
            quantityDelta,
            beforeState: this.json({
              trackingMode: sku.trackingMode,
              pooledQuantity: sku.pooledQuantity,
            }),
            afterState: this.json({ trackingMode: nextMode, pooledQuantity: nextQuantity }),
            reason: dto.reason?.trim() || 'Inventory configuration updated',
            actorUserId: actorUserId ?? null,
          },
        });
      }

      return updated;
    });
  }

  async listStockUnits(tenantId: string, variantSizeId: string) {
    await this.getVariantSize(this.prisma, tenantId, variantSizeId);
    return this.prisma.stockUnit.findMany({
      where: { tenantId, variantSizeId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { assetCode: 'asc' }],
      include: {
        blocks: { where: { endDate: { gte: this.startOfToday() } }, orderBy: { startDate: 'asc' } },
        componentStates: {
          include: { setComponentDefinition: true },
          orderBy: { setComponentDefinition: { displayOrder: 'asc' } },
        },
        issues: {
          where: { status: { in: ['OPEN', 'IN_SERVICE'] } },
          orderBy: { createdAt: 'desc' },
        },
        serviceOrders: {
          where: { status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          where: { releasedAt: null },
          include: { reservation: { select: { bookingId: true, blockedStartDate: true, blockedEndDate: true } } },
          orderBy: { blockedStartDate: 'asc' },
        },
      },
    });
  }

  async createStockUnit(
    tenantId: string,
    variantSizeId: string,
    dto: CreateStockUnitDto,
    actorUserId?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const sku = await this.getVariantSize(tx, tenantId, variantSizeId);
        if (sku.trackingMode !== InventoryTrackingMode.SERIALIZED) {
          throw new ConflictException('Physical units can only be added to serialized inventory');
        }

        const unit = await tx.stockUnit.create({
          data: {
            tenantId,
            variantSizeId,
            assetCode: dto.assetCode.trim(),
            barcode: dto.barcode?.trim() || null,
            condition: dto.condition ?? StockConditionGrade.GOOD,
            locationLabel: dto.locationLabel?.trim() || null,
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
            purchasePrice: dto.purchasePrice ?? null,
            notes: dto.notes?.trim() || null,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantSizeId,
            stockUnitId: unit.id,
            movementType: InventoryMovementType.UNIT_REGISTERED,
            afterState: this.json(unit),
            reason: 'Physical unit registered',
            actorUserId: actorUserId ?? null,
          },
        });
        return unit;
      });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async updateStockUnit(
    tenantId: string,
    stockUnitId: string,
    dto: UpdateStockUnitDto,
    actorUserId?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const unit = await this.getStockUnit(tx, tenantId, stockUnitId);
        if (unit.disposition === StockUnitDisposition.RETIRED) {
          throw new ConflictException('Retired units cannot be edited');
        }

        const updated = await tx.stockUnit.update({
          where: { id: stockUnitId },
          data: {
            ...(dto.assetCode !== undefined ? { assetCode: dto.assetCode.trim() } : {}),
            ...(dto.barcode !== undefined ? { barcode: dto.barcode.trim() || null } : {}),
            ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
            ...(dto.locationLabel !== undefined ? { locationLabel: dto.locationLabel.trim() || null } : {}),
            ...(dto.purchaseDate !== undefined ? { purchaseDate: new Date(dto.purchaseDate) } : {}),
            ...(dto.purchasePrice !== undefined ? { purchasePrice: dto.purchasePrice } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
          },
        });

        if (dto.condition !== undefined && dto.condition !== unit.condition) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantSizeId: unit.variantSizeId,
              stockUnitId,
              movementType: InventoryMovementType.CONDITION_CHANGED,
              beforeState: this.json({ condition: unit.condition }),
              afterState: this.json({ condition: updated.condition }),
              reason: dto.reason?.trim() || 'Condition updated',
              actorUserId: actorUserId ?? null,
            },
          });
        }
        return updated;
      });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async changeStockUnitLifecycle(
    tenantId: string,
    stockUnitId: string,
    action: 'maintenance' | 'restore' | 'retire' | 'lost',
    reason: string,
    actorUserId?: string,
  ) {
    const targets: Record<
      typeof action,
      {
        disposition?: StockUnitDisposition;
        operationalState?: StockUnitOperationalState;
      }
    > = {
      maintenance: { operationalState: StockUnitOperationalState.REPAIRING },
      restore: {
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      },
      retire: { disposition: StockUnitDisposition.RETIRED },
      lost: { disposition: StockUnitDisposition.LOST },
    };
    const target = targets[action];
    return this.lifecycle.transition({
      tenantId,
      stockUnitId,
      actorUserId,
      reason,
      targetDisposition: target.disposition,
      targetOperationalState: target.operationalState,
    });
  }

  async createBlock(
    tenantId: string,
    dto: CreateInventoryBlockDto,
    actorUserId?: string,
  ) {
    const scopeIds = [dto.productId, dto.variantId, dto.variantSizeId, dto.stockUnitId].filter(Boolean);
    if (scopeIds.length !== 1) {
      throw new BadRequestException('Exactly one inventory block scope is required');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) throw new BadRequestException('Start date must be on or before end date');
    if (dto.blockType === 'MAINTENANCE' && !dto.stockUnitId) {
      throw new BadRequestException('Maintenance blocks must target a physical stock unit');
    }

    await this.verifyBlockScope(tenantId, dto);
    return this.prisma.inventoryBlock.create({
      data: {
        tenantId,
        productId: dto.productId ?? null,
        variantId: dto.variantId ?? null,
        variantSizeId: dto.variantSizeId ?? null,
        stockUnitId: dto.stockUnitId ?? null,
        startDate,
        endDate,
        blockType: dto.blockType,
        reason: dto.reason?.trim() || null,
        createdByUserId: actorUserId ?? null,
      },
    });
  }

  async deleteBlock(tenantId: string, blockId: string) {
    const block = await this.prisma.inventoryBlock.findFirst({ where: { id: blockId, tenantId } });
    if (!block) throw new NotFoundException('Inventory block not found');
    await this.prisma.inventoryBlock.delete({ where: { id: blockId } });
    return { message: 'Inventory block removed' };
  }

  async getCalendar(tenantId: string, productId: string, query: InventoryCalendarQueryDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from > to) throw new BadRequestException('from must be on or before to');
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (rangeDays > 366) throw new BadRequestException('Calendar range cannot exceed 366 days');

    const variantSizeWhere = query.variantSizeId
      ? { variantSizeId: query.variantSizeId }
      : { variantSize: { variant: { productId } } };

    const [reservations, blocks, legacyBlocks] = await Promise.all([
      this.prisma.inventoryReservation.findMany({
        where: {
          tenantId,
          productId,
          ...variantSizeWhere,
          status: { in: ['PENDING', 'CONFIRMED'] },
          blockedStartDate: { lte: to },
          blockedEndDate: { gte: from },
        },
        select: {
          id: true,
          variantSizeId: true,
          quantity: true,
          status: true,
          blockedStartDate: true,
          blockedEndDate: true,
        },
      }),
      this.prisma.inventoryBlock.findMany({
        where: {
          tenantId,
          startDate: { lte: to },
          endDate: { gte: from },
          OR: [
            { productId },
            { variant: { productId } },
            { variantSize: { variant: { productId } } },
            { stockUnit: { variantSize: { variant: { productId } } } },
          ],
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          variantSizeId: true,
          stockUnitId: true,
          startDate: true,
          endDate: true,
          blockType: true,
        },
      }),
      this.prisma.dateBlock.findMany({
        where: { tenantId, productId, startDate: { lte: to }, endDate: { gte: from } },
        select: { id: true, startDate: true, endDate: true, blockType: true },
      }),
    ]);

    return { productId, from: query.from, to: query.to, reservations, blocks, legacyBlocks };
  }

  async listMovements(tenantId: string, variantSizeId: string) {
    await this.getVariantSize(this.prisma, tenantId, variantSizeId);
    return this.prisma.inventoryMovement.findMany({
      where: { tenantId, variantSizeId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        stockUnit: { select: { id: true, assetCode: true } },
        actor: { select: { id: true, fullName: true } },
      },
    });
  }

  private async getPeakReservedQuantity(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
  ): Promise<number> {
    const reservations = await tx.inventoryReservation.findMany({
      where: {
        tenantId,
        variantSizeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        blockedEndDate: { gte: this.startOfToday() },
      },
      select: { blockedStartDate: true, blockedEndDate: true, quantity: true },
    });

    const events = reservations.flatMap((reservation) => [
      { date: reservation.blockedStartDate.getTime(), delta: reservation.quantity },
      { date: reservation.blockedEndDate.getTime() + 86_400_000, delta: -reservation.quantity },
    ]).sort((left, right) => left.date - right.date || left.delta - right.delta);

    let current = 0;
    let peak = 0;
    for (const event of events) {
      current += event.delta;
      peak = Math.max(peak, current);
    }
    return peak;
  }

  private async getVariantSize(
    db: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
  ) {
    const sku = await db.variantSize.findFirst({
      where: { id: variantSizeId, tenantId, variant: { product: { deletedAt: null } } },
      include: { sizeInstance: true, variant: { select: { productId: true } } },
    });
    if (!sku) throw new NotFoundException('Variant-size inventory was not found');
    return sku;
  }

  private async getStockUnit(
    db: Prisma.TransactionClient,
    tenantId: string,
    stockUnitId: string,
  ) {
    const unit = await db.stockUnit.findFirst({
      where: { id: stockUnitId, tenantId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Stock unit not found');
    return unit;
  }

  private async verifyBlockScope(tenantId: string, dto: CreateInventoryBlockDto): Promise<void> {
    let exists = false;
    if (dto.productId) {
      exists = Boolean(await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId, deletedAt: null }, select: { id: true } }));
    } else if (dto.variantId) {
      exists = Boolean(await this.prisma.productVariant.findFirst({ where: { id: dto.variantId, tenantId }, select: { id: true } }));
    } else if (dto.variantSizeId) {
      exists = Boolean(await this.prisma.variantSize.findFirst({ where: { id: dto.variantSizeId, tenantId }, select: { id: true } }));
    } else if (dto.stockUnitId) {
      exists = Boolean(await this.prisma.stockUnit.findFirst({ where: { id: dto.stockUnitId, tenantId, deletedAt: null }, select: { id: true } }));
    }
    if (!exists) throw new NotFoundException('Inventory block target not found');
  }

  private rethrowUniqueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Asset code or barcode already exists in this store');
    }
    throw error;
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
