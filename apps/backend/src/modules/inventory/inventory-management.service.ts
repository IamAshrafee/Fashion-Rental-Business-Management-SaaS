import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  StockConditionGrade,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryCalendarQueryDto,
  RegisterStockUnitBatchDto,
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
              const totalCapacity = activeUnits;
              const currentlyUsableCapacity = operationallyAvailableUnits;

              return {
                variantSizeId: sku.id,
                sizeInstance: sku.sizeInstance,
                inventoryVersion: sku.inventoryVersion,
                totalCapacity,
                reservedQuantity,
                availableQuantity: Math.max(0, currentlyUsableCapacity - reservedQuantity),
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

  async createStockUnitBatch(
    tenantId: string,
    variantSizeId: string,
    dto: RegisterStockUnitBatchDto,
    actorUserId?: string,
  ) {
    const normalizedRows = dto.rows.map((row) => ({
      assetCode: this.normalizeAssetCode(row.assetCode),
      barcode: row.barcode?.trim() || null,
      condition: row.condition ?? dto.condition ?? StockConditionGrade.GOOD,
      acquisitionDate: row.acquisitionDate ?? dto.acquisitionDate ?? null,
      acquisitionCost: row.acquisitionCost ?? dto.acquisitionCost ?? null,
      acquisitionSource: row.acquisitionSource?.trim() || dto.acquisitionSource?.trim() || null,
      acquisitionReference:
        row.acquisitionReference?.trim() || dto.acquisitionReference?.trim() || null,
      notes: row.notes?.trim() || dto.notes?.trim() || null,
    }));
    const requestHash = createHash('sha256').update(JSON.stringify({
      variantSizeId,
      locationId: dto.locationId,
      rows: normalizedRows,
      condition: dto.condition ?? StockConditionGrade.GOOD,
      acquisitionDate: dto.acquisitionDate ?? null,
      acquisitionCost: dto.acquisitionCost ?? null,
      acquisitionSource: dto.acquisitionSource?.trim() || null,
      acquisitionReference: dto.acquisitionReference?.trim() || null,
      notes: dto.notes?.trim() || null,
      componentStates: (dto.componentStates ?? []).map((component) => ({
        ...component,
        notes: component.notes?.trim() || null,
      })),
    })).digest('hex');

    const previous = await this.prisma.stockUnit.findMany({
      where: { tenantId, registrationKey: dto.idempotencyKey },
      orderBy: { registrationRow: 'asc' },
      include: { location: true, componentStates: true },
    });
    if (previous.length > 0) {
      if (
        previous.length !== normalizedRows.length
        || previous.some((unit) => unit.registrationHash !== requestHash)
      ) {
        throw new ConflictException({
          code: 'REGISTRATION_KEY_REUSED',
          message: 'This registration key was already used for different item data.',
        });
      }
      return { replayed: true, units: previous };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.getVariantSize(tx, tenantId, variantSizeId);
        await this.locations.getActiveOrThrow(tx, tenantId, dto.locationId, 'canStoreInventory');

        const rowErrors: Array<{ row: number; field: string; code: string; message: string }> = [];
        const assetCodes = normalizedRows.map((row) => row.assetCode);
        const barcodes = normalizedRows.flatMap((row) => row.barcode ? [row.barcode] : []);
        this.collectDuplicateErrors(assetCodes, 'assetCode', rowErrors);
        this.collectDuplicateErrors(
          normalizedRows.map((row) => row.barcode),
          'barcode',
          rowErrors,
        );

        const conflicts = await tx.stockUnit.findMany({
          where: {
            tenantId,
            OR: [
              { assetCode: { in: assetCodes } },
              ...(barcodes.length ? [{ barcode: { in: barcodes } }] : []),
            ],
          },
          select: { assetCode: true, barcode: true },
        });
        for (const [row, identity] of normalizedRows.entries()) {
          if (conflicts.some((unit) => unit.assetCode === identity.assetCode)) {
            rowErrors.push({ row, field: 'assetCode', code: 'ASSET_CODE_EXISTS', message: 'Asset code already exists.' });
          }
          if (identity.barcode && conflicts.some((unit) => unit.barcode === identity.barcode)) {
            rowErrors.push({ row, field: 'barcode', code: 'BARCODE_EXISTS', message: 'Barcode already exists.' });
          }
        }

        const definitions = await tx.skuSetComponentDefinition.findMany({
          where: { tenantId, variantSizeId, isActive: true },
          select: { id: true, requiredQuantity: true },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        const providedComponents = new Map(
          (dto.componentStates ?? []).map((component) => [component.definitionId, component]),
        );
        if (providedComponents.size !== (dto.componentStates?.length ?? 0)) {
          rowErrors.push({ row: -1, field: 'componentStates', code: 'DUPLICATE_COMPONENT', message: 'Each component can be initialized only once.' });
        }
        for (const component of dto.componentStates ?? []) {
          if (!definitions.some((definition) => definition.id === component.definitionId)) {
            rowErrors.push({ row: -1, field: 'componentStates', code: 'INVALID_COMPONENT', message: 'A component does not belong to this SKU.' });
          }
        }
        if (rowErrors.length) {
          throw new ConflictException({
            code: 'BATCH_REGISTRATION_VALIDATION_FAILED',
            message: 'No items were registered. Correct the indicated rows and retry.',
            errors: rowErrors,
          });
        }

        const units = [];
        for (const [rowIndex, identity] of normalizedRows.entries()) {
          const unit = await tx.stockUnit.create({
            data: {
              tenantId,
              variantSizeId,
              locationId: dto.locationId,
              assetCode: identity.assetCode,
              barcode: identity.barcode,
              condition: identity.condition,
              acquisitionDate: identity.acquisitionDate
                ? new Date(identity.acquisitionDate)
                : null,
              acquisitionCost: identity.acquisitionCost,
              acquisitionSource: identity.acquisitionSource,
              acquisitionReference: identity.acquisitionReference,
              notes: identity.notes,
              registrationKey: dto.idempotencyKey,
              registrationHash: requestHash,
              registrationRow: rowIndex,
              componentStates: {
                create: definitions.map((definition) => {
                  const configured = providedComponents.get(definition.id);
                  return {
                    tenantId,
                    setComponentDefinitionId: definition.id,
                    presence: configured?.presence ?? 'PRESENT',
                    presentQuantity: configured?.presentQuantity ?? definition.requiredQuantity,
                    condition: configured?.condition ?? identity.condition,
                    notes: configured?.notes?.trim() || null,
                  };
                }),
              },
            },
            include: { location: true, componentStates: true },
          });
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantSizeId,
              stockUnitId: unit.id,
              destinationLocationId: dto.locationId,
              movementType: InventoryMovementType.UNIT_REGISTERED,
              afterState: this.json(unit),
              reason: `Physical item registered in batch ${dto.idempotencyKey}`,
              actorUserId: actorUserId ?? null,
            },
          });
          units.push(unit);
        }
        return { replayed: false, units };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
        const correctionRequested = [
          dto.assetCode,
          dto.barcode,
          dto.condition,
          dto.acquisitionDate,
          dto.acquisitionCost,
          dto.acquisitionSource,
          dto.acquisitionReference,
          dto.notes,
          dto.estimatedCurrentValue,
        ].some((value) => value !== undefined);
        if (correctionRequested && !dto.reason?.trim()) {
          throw new BadRequestException(
            'A correction reason is required when changing identity, acquisition, condition, notes, or valuation data',
          );
        }
        if (correctionRequested && dto.expectedVersion === undefined) {
          throw new BadRequestException(
            'The current physical-item version is required for an audited correction',
          );
        }

        const updateData: Prisma.StockUnitUpdateManyMutationInput = {
            ...(dto.assetCode !== undefined
              ? { assetCode: this.normalizeAssetCode(dto.assetCode) }
              : {}),
            ...(dto.barcode !== undefined ? { barcode: dto.barcode.trim() || null } : {}),
            ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
            ...(dto.acquisitionDate !== undefined
              ? { acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null }
              : {}),
            ...(dto.acquisitionCost !== undefined ? { acquisitionCost: dto.acquisitionCost } : {}),
            ...(dto.acquisitionSource !== undefined
              ? { acquisitionSource: dto.acquisitionSource.trim() || null }
              : {}),
            ...(dto.acquisitionReference !== undefined
              ? { acquisitionReference: dto.acquisitionReference.trim() || null }
              : {}),
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
            ...(correctionRequested ? { version: { increment: 1 } } : {}),
        };
        if (correctionRequested) {
          const result = await tx.stockUnit.updateMany({
            where: {
              id: stockUnitId,
              tenantId,
              version: dto.expectedVersion,
              deletedAt: null,
            },
            data: updateData,
          });
          if (result.count !== 1) {
            throw new ConflictException({
              code: 'STALE_PHYSICAL_ITEM',
              message: 'This physical item changed after you opened it. Reload before applying the correction.',
              expectedVersion: dto.expectedVersion,
            });
          }
        } else {
          await tx.stockUnit.update({ where: { id: stockUnitId }, data: updateData });
        }
        const updated = await tx.stockUnit.findUniqueOrThrow({ where: { id: stockUnitId } });

        const metadataCorrectionRequested = [
          dto.assetCode,
          dto.barcode,
          dto.acquisitionDate,
          dto.acquisitionCost,
          dto.acquisitionSource,
          dto.acquisitionReference,
          dto.notes,
        ].some((value) => value !== undefined);
        if (metadataCorrectionRequested) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantSizeId: unit.variantSizeId,
              stockUnitId,
              movementType: InventoryMovementType.ADMIN_CORRECTION,
              beforeState: this.json({
                assetCode: unit.assetCode,
                barcode: unit.barcode,
                acquisitionDate: unit.acquisitionDate,
                acquisitionCost: unit.acquisitionCost,
                acquisitionSource: unit.acquisitionSource,
                acquisitionReference: unit.acquisitionReference,
                notes: unit.notes,
              }),
              afterState: this.json({
                assetCode: updated.assetCode,
                barcode: updated.barcode,
                acquisitionDate: updated.acquisitionDate,
                acquisitionCost: updated.acquisitionCost,
                acquisitionSource: updated.acquisitionSource,
                acquisitionReference: updated.acquisitionReference,
                notes: updated.notes,
              }),
              reason: dto.reason!.trim(),
              actorUserId: actorUserId ?? null,
            },
          });
        }

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
          reason: true,
          serviceOrder: { select: { id: true } },
          inspection: { select: { id: true } },
        },
      }),
    ]);

    return {
      productId,
      from: query.from,
      to: query.to,
      reservations,
      blocks: blocks.map((block) => ({
        ...block,
        canDelete:
          ['MANUAL', 'LOCATION_BLACKOUT', 'SKU_BLACKOUT'].includes(block.blockType) &&
          !block.serviceOrder &&
          !block.inspection,
      })),
    };
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

  private rethrowUniqueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Asset code or barcode already exists in this store');
    }
    throw error;
  }

  private normalizeAssetCode(value: string): string {
    return value.trim().toUpperCase();
  }

  private collectDuplicateErrors(
    values: Array<string | null>,
    field: string,
    errors: Array<{ row: number; field: string; code: string; message: string }>,
  ) {
    const firstRow = new Map<string, number>();
    values.forEach((value, row) => {
      if (!value) return;
      const previousRow = firstRow.get(value);
      if (previousRow === undefined) {
        firstRow.set(value, row);
        return;
      }
      errors.push({
        row,
        field,
        code: `DUPLICATE_${field.toUpperCase()}`,
        message: `Duplicates row ${previousRow + 1}.`,
      });
    });
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
