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
import { InventoryLocationService } from './inventory-location.service';

@Injectable()
export class InventoryManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: StockUnitLifecycleService,
    private readonly locations: InventoryLocationService,
  ) {}

  async getProductInventory(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        isAvailable: true,
        storefrontItemMode: true,
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
                inventoryVersion: true,
                inventoryPools: {
                  where: { location: { isActive: true } },
                  include: {
                    location: { select: { id: true, code: true, name: true, isDefault: true } },
                  },
                  orderBy: { location: { name: 'asc' } },
                },
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
              const [unitCounts, reservationByLocation] = await Promise.all([
                this.prisma.stockUnit.groupBy({
                  by: ['locationId', 'disposition', 'operationalState'],
                  where: { tenantId, variantSizeId: sku.id, deletedAt: null },
                  _count: { _all: true },
                }),
                this.prisma.inventoryReservation.groupBy({
                  by: ['sourceLocationId'],
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

              const activeUnits = unitCounts
                .filter((entry) => entry.disposition === StockUnitDisposition.ACTIVE)
                .reduce((sum, entry) => sum + entry._count._all, 0);
              const operationallyAvailableUnits = unitCounts
                .filter(
                  (entry) =>
                    entry.disposition === StockUnitDisposition.ACTIVE &&
                    entry.operationalState === StockUnitOperationalState.AVAILABLE,
                )
                .reduce((sum, entry) => sum + entry._count._all, 0);
              const reservedQuantity = reservationByLocation.reduce(
                (sum, entry) => sum + (entry._sum.quantity ?? 0),
                0,
              );
              const pooledCapacity = sku.inventoryPools.reduce(
                (sum, pool) => sum + pool.onHandQuantity,
                0,
              );
              const totalCapacity =
                sku.trackingMode === InventoryTrackingMode.POOLED
                  ? pooledCapacity
                  : activeUnits;
              const currentlyUsableCapacity =
                sku.trackingMode === InventoryTrackingMode.POOLED
                  ? pooledCapacity
                  : operationallyAvailableUnits;

              return {
                variantSizeId: sku.id,
                sizeInstance: sku.sizeInstance,
                trackingMode: sku.trackingMode,
                inventoryVersion: sku.inventoryVersion,
                totalCapacity,
                reservedQuantity,
                availableQuantity: Math.max(0, currentlyUsableCapacity - reservedQuantity),
                pools: sku.inventoryPools.map((pool) => ({
                  id: pool.id,
                  location: pool.location,
                  onHandQuantity: pool.onHandQuantity,
                  reorderThreshold: pool.reorderThreshold,
                  reservedQuantity:
                    reservationByLocation.find(
                      (entry) => entry.sourceLocationId === pool.locationId,
                    )?._sum.quantity ?? 0,
                })),
                unitCounts: unitCounts.map((entry) => ({
                  locationId: entry.locationId,
                  disposition: entry.disposition,
                  operationalState: entry.operationalState,
                  quantity: entry._count._all,
                })),
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
    return this.prisma.$transaction(async (tx) => {
      const sku = await this.getVariantSize(tx, tenantId, variantSizeId);
      const nextMode = dto.trackingMode;

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
              disposition: { in: ['ACTIVE', 'QUARANTINED'] },
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

      if (nextMode === InventoryTrackingMode.SERIALIZED) {
        const pooledStock = await tx.inventoryPool.aggregate({
          where: { tenantId, variantSizeId },
          _sum: { onHandQuantity: true },
        });
        if ((pooledStock._sum.onHandQuantity ?? 0) > 0) {
          throw new ConflictException({
            code: 'TRACKING_MODE_HAS_POOLED_STOCK',
            message: 'Move or count pooled stock down to zero before enabling serialized tracking',
          });
        }
      }

      const updated = await tx.variantSize.update({
        where: { id: variantSizeId },
        data: {
          trackingMode: nextMode,
          inventoryVersion: { increment: 1 },
        },
        include: { sizeInstance: true },
      });

      if (nextMode !== sku.trackingMode) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantSizeId,
            movementType: InventoryMovementType.ADMIN_CORRECTION,
            quantityDelta: 0,
            beforeState: this.json({
              trackingMode: sku.trackingMode,
            }),
            afterState: this.json({ trackingMode: nextMode }),
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
      orderBy: [{ disposition: 'asc' }, { operationalState: 'asc' }, { assetCode: 'asc' }],
      include: {
        location: true,
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
        await this.locations.getActiveOrThrow(
          tx,
          tenantId,
          dto.locationId,
          'canStoreInventory',
        );

        const unit = await tx.stockUnit.create({
          data: {
            tenantId,
            variantSizeId,
            locationId: dto.locationId,
            assetCode: dto.assetCode.trim(),
            barcode: dto.barcode?.trim() || null,
            condition: dto.condition ?? StockConditionGrade.GOOD,
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
            purchasePrice: dto.purchasePrice ?? null,
            notes: dto.notes?.trim() || null,
            storefrontVisible: dto.storefrontVisible ?? false,
            publicConditionNote: dto.publicConditionNote?.trim() || null,
            rentalPriceAdjustment: dto.rentalPriceAdjustment ?? 0,
            estimatedCurrentValue: dto.estimatedCurrentValue ?? null,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantSizeId,
            stockUnitId: unit.id,
            destinationLocationId: dto.locationId,
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
            ...(dto.purchaseDate !== undefined ? { purchaseDate: new Date(dto.purchaseDate) } : {}),
            ...(dto.purchasePrice !== undefined ? { purchasePrice: dto.purchasePrice } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
            ...(dto.storefrontVisible !== undefined
              ? { storefrontVisible: dto.storefrontVisible }
              : {}),
            ...(dto.publicConditionNote !== undefined
              ? { publicConditionNote: dto.publicConditionNote.trim() || null }
              : {}),
            ...(dto.rentalPriceAdjustment !== undefined
              ? { rentalPriceAdjustment: dto.rentalPriceAdjustment }
              : {}),
            ...(dto.estimatedCurrentValue !== undefined
              ? { estimatedCurrentValue: dto.estimatedCurrentValue }
              : {}),
            ...(dto.storefrontSortOrder !== undefined
              ? { storefrontSortOrder: dto.storefrontSortOrder }
              : {}),
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
        if (
          dto.estimatedCurrentValue !== undefined &&
          dto.estimatedCurrentValue !== unit.estimatedCurrentValue
        ) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantSizeId: unit.variantSizeId,
              stockUnitId,
              movementType: InventoryMovementType.VALUATION_CHANGED,
              beforeState: this.json({ estimatedCurrentValue: unit.estimatedCurrentValue }),
              afterState: this.json({ estimatedCurrentValue: updated.estimatedCurrentValue }),
              reason: dto.reason?.trim() || 'Estimated current value updated',
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

    const [reservations, blocks] = await Promise.all([
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
    ]);

    return { productId, from: query.from, to: query.to, reservations, blocks };
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
