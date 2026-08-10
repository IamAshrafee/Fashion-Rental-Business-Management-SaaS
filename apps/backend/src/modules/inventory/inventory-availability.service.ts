import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTrackingMode, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AvailabilityPolicyService,
  EffectiveAvailabilityPolicy,
} from './availability-policy.service';

type InventoryDatabase = Prisma.TransactionClient;

export interface InventoryAvailabilityInput {
  tenantId: string;
  productId: string;
  variantSizeId: string;
  preferredStockUnitId?: string;
  sourceLocationId?: string;
  startDate: string | Date;
  endDate: string | Date;
  quantity?: number;
  enforcePublished?: boolean;
  allowPreferredOutsideStorefrontMode?: boolean;
  requireStorefrontVisibility?: boolean;
  excludeReservationId?: string;
}

export interface InventoryAvailabilityResult {
  productId: string;
  variantId: string;
  variantSizeId: string;
  sizeInstanceId: string;
  sourceLocationId: string | null;
  sourceLocation: { code: string; name: string } | null;
  inventoryPoolId: string | null;
  trackingMode: InventoryTrackingMode;
  available: boolean;
  requestedQuantity: number;
  totalCapacity: number;
  blockedQuantity: number;
  reservedQuantity: number;
  remainingQuantity: number;
  rentalRange: { start: string; end: string };
  effectiveBlockedRange: { start: string; end: string };
  availabilityPolicy: EffectiveAvailabilityPolicy | null;
  reason?: string;
}

@Injectable()
export class InventoryAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: AvailabilityPolicyService,
  ) {}

  async check(
    input: InventoryAvailabilityInput,
    transaction?: InventoryDatabase,
  ): Promise<InventoryAvailabilityResult> {
    const db = transaction ?? this.prisma;
    const quantity = input.quantity ?? 1;
    const rentalStart = this.parseDate(input.startDate, 'startDate');
    const rentalEnd = this.parseDate(input.endDate, 'endDate');
    if (quantity < 1) throw new BadRequestException('quantity must be at least 1');
    if (rentalStart > rentalEnd) {
      return this.unavailableResult(input, quantity, rentalStart, rentalEnd, 'Start date must be on or before end date');
    }

    const sku = await db.variantSize.findFirst({
      where: {
        id: input.variantSizeId,
        tenantId: input.tenantId,
        variant: { productId: input.productId },
      },
      select: {
        id: true,
        variantId: true,
        sizeInstanceId: true,
        trackingMode: true,
        variant: {
          select: {
            product: {
              select: {
                id: true,
                status: true,
                isAvailable: true,
                availableFrom: true,
                deletedAt: true,
                storefrontItemMode: true,
              },
            },
          },
        },
      },
    });
    if (!sku) throw new NotFoundException('Variant-size inventory was not found');

    const productReason = this.productUnavailableReason(
      sku.variant.product,
      rentalStart,
      input.enforcePublished !== false,
    );
    if (productReason) {
      return this.unavailableResult(input, quantity, rentalStart, rentalEnd, productReason, sku);
    }
    if (
      input.preferredStockUnitId &&
      (quantity !== 1 ||
        (!input.allowPreferredOutsideStorefrontMode &&
          sku.variant.product.storefrontItemMode !== 'SPECIFIC_ITEM_SELECTION') ||
        sku.trackingMode !== InventoryTrackingMode.SERIALIZED)
    ) {
      return this.unavailableResult(
        input,
        quantity,
        rentalStart,
        rentalEnd,
        'Specific item selection is not enabled for this product and SKU',
        sku,
      );
    }

    const locations = await db.inventoryLocation.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        canStoreInventory: true,
        canFulfillRentals: true,
        ...(input.sourceLocationId ? { id: input.sourceLocationId } : {}),
      },
      select: { id: true, code: true, name: true, timezone: true, isDefault: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    if (input.sourceLocationId && locations.length === 0) {
      throw new NotFoundException('Fulfillment location was not found or is not operational');
    }
    if (locations.length === 0) {
      return this.unavailableResult(
        input,
        quantity,
        rentalStart,
        rentalEnd,
        'No active fulfillment location is configured',
        sku,
      );
    }

    const results: InventoryAvailabilityResult[] = [];
    for (const location of locations) {
      results.push(
        await this.checkAtLocation(db, input, sku, location, quantity, rentalStart, rentalEnd),
      );
    }
    return results.sort((left, right) => {
      if (left.available !== right.available) return left.available ? -1 : 1;
      return right.remainingQuantity - left.remainingQuantity;
    })[0];
  }

  /**
   * Finds the first date on which the same rental duration can fit. Candidate
   * dates are derived from the ends of actual reservations/blocks, so this
   * avoids a query-heavy day-by-day scan while preserving authoritative checks.
   */
  async findNextAvailable(
    input: InventoryAvailabilityInput,
    current: InventoryAvailabilityResult,
  ): Promise<string | null> {
    if (current.available || !current.availabilityPolicy) return null;
    const rentalStart = this.parseDate(input.startDate, 'startDate');
    const rentalEnd = this.parseDate(input.endDate, 'endDate');
    const durationDays = Math.floor((rentalEnd.getTime() - rentalStart.getTime()) / 86_400_000);
    const policy = current.availabilityPolicy;
    const horizon = new Date(rentalStart);
    horizon.setUTCDate(horizon.getUTCDate() + Math.min(365, policy.maximumAdvanceDays));
    const blockedStart = new Date(current.effectiveBlockedRange.start);

    const [reservations, blocks] = await Promise.all([
      this.prisma.inventoryReservation.findMany({
        where: {
          tenantId: input.tenantId,
          variantSizeId: input.variantSizeId,
          ...(input.sourceLocationId ? { sourceLocationId: input.sourceLocationId } : {}),
          ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
          blockedEndDate: { gte: blockedStart },
          blockedStartDate: { lte: horizon },
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        select: { blockedEndDate: true },
        orderBy: { blockedEndDate: 'asc' },
        take: 250,
      }),
      this.prisma.inventoryBlock.findMany({
        where: {
          tenantId: input.tenantId,
          endDate: { gte: blockedStart },
          startDate: { lte: horizon },
          ...(input.sourceLocationId
            ? { AND: [{ OR: [{ locationId: null }, { locationId: input.sourceLocationId }] }] }
            : {}),
          OR: [
            { productId: input.productId },
            { variantId: current.variantId },
            { variantSizeId: input.variantSizeId },
            ...(input.preferredStockUnitId ? [{ stockUnitId: input.preferredStockUnitId }] : []),
            { blockType: 'LOCATION_BLACKOUT' },
            { inventoryPool: { variantSizeId: input.variantSizeId } },
          ],
        },
        select: { endDate: true },
        orderBy: { endDate: 'asc' },
        take: 250,
      }),
    ]);

    const preparationDays = Math.ceil(
      (policy.preparationBufferMinutes + policy.deliveryBufferMinutes) / 1_440,
    );
    const candidateTimestamps = new Set<number>();
    for (const conflictEnd of [
      ...reservations.map((row) => row.blockedEndDate),
      ...blocks.map((row) => row.endDate),
    ]) {
      const candidate = new Date(conflictEnd);
      candidate.setUTCDate(candidate.getUTCDate() + preparationDays + 1);
      if (candidate > rentalStart && candidate <= horizon) candidateTimestamps.add(candidate.getTime());
    }

    const candidates = [...candidateTimestamps]
      .sort((left, right) => left - right)
      .slice(0, 60)
      .map((timestamp) => new Date(timestamp));
    for (let index = 0; index < candidates.length; index += 5) {
      const batch = candidates.slice(index, index + 5);
      const checks = await Promise.all(batch.map((candidateStart) => {
        const candidateEnd = new Date(candidateStart);
        candidateEnd.setUTCDate(candidateEnd.getUTCDate() + durationDays);
        return this.check({
          ...input,
          startDate: this.formatDate(candidateStart),
          endDate: this.formatDate(candidateEnd),
        });
      }));
      const availableIndex = checks.findIndex((result) => result.available);
      if (availableIndex >= 0) return this.formatDate(batch[availableIndex]);
    }
    return null;
  }

  async listPublicItemOptions(
    tenantId: string,
    productId: string,
    query: {
      variantSizeId: string;
      startDate: string;
      endDate: string;
    },
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
        status: 'published',
        isAvailable: true,
        deletedAt: null,
      },
      select: { storefrontItemMode: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.storefrontItemMode === 'INTERNAL_ONLY') {
      return { mode: product.storefrontItemMode, summary: [], items: [] };
    }

    const units = await this.prisma.stockUnit.findMany({
      where: {
        tenantId,
        variantSizeId: query.variantSizeId,
        variantSize: { variant: { productId } },
        storefrontVisible: true,
        disposition: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        condition: true,
        publicConditionNote: true,
        rentalPriceAdjustment: true,
        storefrontSortOrder: true,
        mediaAttachments: {
          where: { isPublicApproved: true, purpose: 'UNIT_REFERENCE' },
          orderBy: { createdAt: 'desc' },
          take: 4,
          select: { id: true, url: true, caption: true },
        },
      },
      orderBy: [{ storefrontSortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (product.storefrontItemMode === 'CONDITION_SUMMARY') {
      const datedUnits = await Promise.all(
        units.map(async (unit) => ({
          unit,
          availability: await this.check({
            tenantId,
            productId,
            variantSizeId: query.variantSizeId,
            preferredStockUnitId: unit.id,
            startDate: query.startDate,
            endDate: query.endDate,
            quantity: 1,
            allowPreferredOutsideStorefrontMode: true,
          }),
        })),
      );
      const grouped = new Map<
        string,
        { condition: string; count: number; minimumAdjustment: number; maximumAdjustment: number }
      >();
      for (const { unit, availability } of datedUnits) {
        if (!availability.available) continue;
        const current = grouped.get(unit.condition) ?? {
          condition: unit.condition,
          count: 0,
          minimumAdjustment: unit.rentalPriceAdjustment,
          maximumAdjustment: unit.rentalPriceAdjustment,
        };
        current.count += 1;
        current.minimumAdjustment = Math.min(current.minimumAdjustment, unit.rentalPriceAdjustment);
        current.maximumAdjustment = Math.max(current.maximumAdjustment, unit.rentalPriceAdjustment);
        grouped.set(unit.condition, current);
      }
      return {
        mode: product.storefrontItemMode,
        summary: [...grouped.values()],
        items: [],
      };
    }

    const items = await Promise.all(
      units.map(async (unit, index) => {
        const availability = await this.check({
          tenantId,
          productId,
          variantSizeId: query.variantSizeId,
          preferredStockUnitId: unit.id,
          startDate: query.startDate,
          endDate: query.endDate,
          quantity: 1,
        });
        return {
          id: unit.id,
          label: `Piece ${index + 1}`,
          condition: unit.condition,
          conditionNote: unit.publicConditionNote,
          priceAdjustment: unit.rentalPriceAdjustment,
          media: unit.mediaAttachments,
          available: availability.available,
        };
      }),
    );
    return { mode: product.storefrontItemMode, summary: [], items };
  }

  async getEffectiveBlockedRange(
    tenantId: string,
    productId: string,
    variantSizeId: string,
    sourceLocationId: string,
    startDate: string | Date,
    endDate: string | Date,
    transaction?: InventoryDatabase,
  ) {
    const db = transaction ?? this.prisma;
    const rentalStart = this.parseDate(startDate, 'startDate');
    const rentalEnd = this.parseDate(endDate, 'endDate');
    const policy = await this.policies.resolve(
      db,
      tenantId,
      productId,
      variantSizeId,
      sourceLocationId,
    );
    return { rentalStart, rentalEnd, ...this.policies.calculateBlockedRange(rentalStart, rentalEnd, policy), policy };
  }

  parseDate(value: string | Date, fieldName = 'date'): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${fieldName}`);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private async checkAtLocation(
    db: InventoryDatabase,
    input: InventoryAvailabilityInput,
    sku: {
      id: string;
      variantId: string;
      sizeInstanceId: string;
      trackingMode: InventoryTrackingMode;
    },
    location: { id: string; code: string; name: string; timezone: string },
    quantity: number,
    rentalStart: Date,
    rentalEnd: Date,
  ): Promise<InventoryAvailabilityResult> {
    const policy = await this.policies.resolve(
      db,
      input.tenantId,
      input.productId,
      sku.id,
      location.id,
    );
    const { blockedStart, blockedEnd } = this.policies.calculateBlockedRange(
      rentalStart,
      rentalEnd,
      policy,
    );
    const policyReason = this.policyUnavailableReason(policy, rentalStart, location.timezone);
    if (policyReason) {
      return this.locationResult(input, sku, location, quantity, rentalStart, rentalEnd, blockedStart, blockedEnd, policy, {
        totalCapacity: 0,
        blockedQuantity: 0,
        reservedQuantity: 0,
        reason: policyReason,
      });
    }

    const pool = sku.trackingMode === InventoryTrackingMode.POOLED
      ? await db.inventoryPool.findUnique({
          where: { variantSizeId_locationId: { variantSizeId: sku.id, locationId: location.id } },
          select: { id: true, onHandQuantity: true },
        })
      : null;
    const fullBlock = await db.inventoryBlock.findFirst({
      where: {
        tenantId: input.tenantId,
        startDate: { lte: blockedEnd },
        endDate: { gte: blockedStart },
        quantity: null,
        AND: [
          { OR: [{ locationId: null }, { locationId: location.id }] },
          {
            OR: [
              { productId: input.productId },
              { variantId: sku.variantId },
              { variantSizeId: sku.id },
              { locationId: location.id, blockType: 'LOCATION_BLACKOUT' },
              ...(pool ? [{ inventoryPoolId: pool.id }] : []),
            ],
          },
        ],
      },
      select: { id: true },
    });
    if (fullBlock) {
      return this.locationResult(
        input,
        sku,
        location,
        quantity,
        rentalStart,
        rentalEnd,
        blockedStart,
        blockedEnd,
        policy,
        {
          inventoryPoolId: pool?.id ?? null,
          totalCapacity: 0,
          blockedQuantity: 0,
          reservedQuantity: 0,
          reason: 'Inventory is blocked at this location for the selected dates',
        },
      );
    }

    if (input.preferredStockUnitId) {
      return this.checkPreferredUnitAtLocation(
        db,
        input,
        sku,
        location,
        rentalStart,
        rentalEnd,
        blockedStart,
        blockedEnd,
        policy,
      );
    }

    const [totalCapacity, blockedQuantity, reservationAggregate] = await Promise.all([
      this.resolveCapacity(
        db,
        input.tenantId,
        sku.id,
        location.id,
        sku.trackingMode,
        pool?.onHandQuantity ?? 0,
        policy,
        blockedStart,
        blockedEnd,
      ),
      pool
        ? db.inventoryBlock.aggregate({
            where: {
              tenantId: input.tenantId,
              inventoryPoolId: pool.id,
              startDate: { lte: blockedEnd },
              endDate: { gte: blockedStart },
              quantity: { not: null },
            },
            _sum: { quantity: true },
          }).then((result) => result._sum.quantity ?? 0)
        : Promise.resolve(0),
      db.inventoryReservation.aggregate({
        where: {
          tenantId: input.tenantId,
          sourceLocationId: location.id,
          ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
          variantSizeId: sku.id,
          blockedStartDate: { lte: blockedEnd },
          blockedEndDate: { gte: blockedStart },
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        _sum: { quantity: true },
      }),
    ]);

    const reservedQuantity = reservationAggregate._sum.quantity ?? 0;
    const effectiveCapacity = Math.max(0, totalCapacity - blockedQuantity);
    const shortageCapacity = policy.allowShortage ? policy.shortageLimit : 0;
    const remainingQuantity = Math.max(0, effectiveCapacity + shortageCapacity - reservedQuantity);
    return this.locationResult(input, sku, location, quantity, rentalStart, rentalEnd, blockedStart, blockedEnd, policy, {
      inventoryPoolId: pool?.id ?? null,
      totalCapacity,
      blockedQuantity,
      reservedQuantity,
      reason: remainingQuantity < quantity
          ? 'Requested quantity is not available at this location'
          : undefined,
    });
  }

  private async resolveCapacity(
    db: InventoryDatabase,
    tenantId: string,
    variantSizeId: string,
    locationId: string,
    trackingMode: InventoryTrackingMode,
    onHandQuantity: number,
    policy: EffectiveAvailabilityPolicy,
    blockedStart: Date,
    blockedEnd: Date,
  ) {
    if (trackingMode === InventoryTrackingMode.POOLED) return Math.max(0, onHandQuantity);
    return db.stockUnit.count({
      where: {
        tenantId,
        variantSizeId,
        locationId,
        disposition: 'ACTIVE',
        operationalState: { in: policy.eligibleOperationalStates },
        condition: { in: policy.eligibleConditionGrades },
        deletedAt: null,
        issues: { none: { isAvailabilityBlocking: true, status: { in: ['OPEN', 'IN_SERVICE'] } } },
        componentStates: {
          none: {
            setComponentDefinition: { isActive: true, absenceBlocksRental: true },
            presence: { in: ['MISSING', 'DAMAGED'] },
          },
        },
        blocks: { none: { startDate: { lte: blockedEnd }, endDate: { gte: blockedStart } } },
      },
    });
  }

  private async checkPreferredUnitAtLocation(
    db: InventoryDatabase,
    input: InventoryAvailabilityInput,
    sku: { id: string; variantId: string; sizeInstanceId: string; trackingMode: InventoryTrackingMode },
    location: { id: string; code: string; name: string; timezone: string },
    rentalStart: Date,
    rentalEnd: Date,
    blockedStart: Date,
    blockedEnd: Date,
    policy: EffectiveAvailabilityPolicy,
  ): Promise<InventoryAvailabilityResult> {
    const [eligibleUnit, overallCapacity, reservations] = await Promise.all([
      db.stockUnit.findFirst({
        where: {
          id: input.preferredStockUnitId,
          tenantId: input.tenantId,
          variantSizeId: sku.id,
          locationId: location.id,
          ...(input.requireStorefrontVisibility === false ? {} : { storefrontVisible: true }),
          disposition: 'ACTIVE',
          operationalState: { in: policy.eligibleOperationalStates },
          condition: { in: policy.eligibleConditionGrades },
          deletedAt: null,
          issues: { none: { isAvailabilityBlocking: true, status: { in: ['OPEN', 'IN_SERVICE'] } } },
          componentStates: {
            none: {
              setComponentDefinition: { isActive: true, absenceBlocksRental: true },
              presence: { in: ['MISSING', 'DAMAGED'] },
            },
          },
          blocks: { none: { startDate: { lte: blockedEnd }, endDate: { gte: blockedStart } } },
          assignments: {
            none: {
              releasedAt: null,
              blockedStartDate: { lte: blockedEnd },
              blockedEndDate: { gte: blockedStart },
            },
          },
        },
        select: { id: true },
      }),
      this.resolveCapacity(
        db,
        input.tenantId,
        sku.id,
        location.id,
        sku.trackingMode,
        0,
        policy,
        blockedStart,
        blockedEnd,
      ),
      db.inventoryReservation.findMany({
        where: {
          tenantId: input.tenantId,
          sourceLocationId: location.id,
          variantSizeId: sku.id,
          ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
          blockedStartDate: { lte: blockedEnd },
          blockedEndDate: { gte: blockedStart },
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        select: { quantity: true, preferredStockUnitId: true },
      }),
    ]);

    const selectedAlreadyReserved = reservations.some(
      (reservation) => reservation.preferredStockUnitId === input.preferredStockUnitId,
    );
    const genericReserved = reservations
      .filter((reservation) => reservation.preferredStockUnitId === null)
      .reduce((sum, reservation) => sum + reservation.quantity, 0);
    const otherSpecificUnits = new Set(
      reservations.flatMap((reservation) =>
        reservation.preferredStockUnitId &&
        reservation.preferredStockUnitId !== input.preferredStockUnitId
          ? [reservation.preferredStockUnitId]
          : [],
      ),
    ).size;
    const enoughUncommittedAlternatives =
      genericReserved <= Math.max(0, overallCapacity - otherSpecificUnits - 1);
    const available = Boolean(eligibleUnit) && !selectedAlreadyReserved && enoughUncommittedAlternatives;
    return this.locationResult(
      input,
      sku,
      location,
      1,
      rentalStart,
      rentalEnd,
      blockedStart,
      blockedEnd,
      policy,
      {
        totalCapacity: eligibleUnit ? 1 : 0,
        blockedQuantity: 0,
        reservedQuantity: available ? 0 : 1,
        reason: available ? undefined : 'This physical item is unavailable for the selected dates',
      },
    );
  }

  private productUnavailableReason(
    product: { status: ProductStatus; isAvailable: boolean; availableFrom: Date | null; deletedAt: Date | null },
    rentalStart: Date,
    enforcePublished: boolean,
  ) {
    if (product.deletedAt) return 'Product is not available';
    if (enforcePublished && product.status !== ProductStatus.published) return 'Product is not published';
    if (!product.isAvailable || (product.availableFrom && product.availableFrom > rentalStart)) {
      return 'Product is currently unavailable';
    }
    return null;
  }

  private policyUnavailableReason(
    policy: EffectiveAvailabilityPolicy,
    rentalStart: Date,
    timeZone: string,
  ) {
    const start = this.localDateStartInstant(rentalStart, timeZone).getTime();
    const now = Date.now();
    if (start < now + policy.minimumNoticeMinutes * 60_000) {
      return 'The rental does not meet the minimum notice period';
    }
    if (start > now + policy.maximumAdvanceDays * 86_400_000) {
      return 'The rental date is beyond the maximum booking window';
    }
    return null;
  }

  private localDateStartInstant(date: Date, timeZone: string): Date {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const utcGuess = new Date(Date.UTC(year, month, day));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const values = Object.fromEntries(
      formatter.formatToParts(utcGuess)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const representedLocalTime = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    );
    return new Date(utcGuess.getTime() - (representedLocalTime - utcGuess.getTime()));
  }

  private locationResult(
    input: InventoryAvailabilityInput,
    sku: { id: string; variantId: string; sizeInstanceId: string; trackingMode: InventoryTrackingMode },
    location: { id: string; code: string; name: string; timezone: string },
    quantity: number,
    rentalStart: Date,
    rentalEnd: Date,
    blockedStart: Date,
    blockedEnd: Date,
    policy: EffectiveAvailabilityPolicy,
    capacity: {
      inventoryPoolId?: string | null;
      totalCapacity: number;
      blockedQuantity: number;
      reservedQuantity: number;
      reason?: string;
    },
  ): InventoryAvailabilityResult {
    const effectiveCapacity = Math.max(0, capacity.totalCapacity - capacity.blockedQuantity);
    const shortageCapacity = policy.allowShortage ? policy.shortageLimit : 0;
    const remainingQuantity = Math.max(0, effectiveCapacity + shortageCapacity - capacity.reservedQuantity);
    return {
      productId: input.productId,
      variantId: sku.variantId,
      variantSizeId: sku.id,
      sizeInstanceId: sku.sizeInstanceId,
      sourceLocationId: location.id,
      sourceLocation: { code: location.code, name: location.name },
      inventoryPoolId: capacity.inventoryPoolId ?? null,
      trackingMode: sku.trackingMode,
      available: !capacity.reason && remainingQuantity >= quantity,
      requestedQuantity: quantity,
      totalCapacity: capacity.totalCapacity,
      blockedQuantity: capacity.blockedQuantity,
      reservedQuantity: capacity.reservedQuantity,
      remainingQuantity,
      rentalRange: { start: this.formatDate(rentalStart), end: this.formatDate(rentalEnd) },
      effectiveBlockedRange: { start: this.formatDate(blockedStart), end: this.formatDate(blockedEnd) },
      availabilityPolicy: policy,
      ...(capacity.reason ? { reason: capacity.reason } : {}),
    };
  }

  private unavailableResult(
    input: InventoryAvailabilityInput,
    quantity: number,
    rentalStart: Date,
    rentalEnd: Date,
    reason: string,
    sku?: { variantId: string; sizeInstanceId: string; trackingMode: InventoryTrackingMode },
  ): InventoryAvailabilityResult {
    return {
      productId: input.productId,
      variantId: sku?.variantId ?? '',
      variantSizeId: input.variantSizeId,
      sizeInstanceId: sku?.sizeInstanceId ?? '',
      sourceLocationId: input.sourceLocationId ?? null,
      sourceLocation: null,
      inventoryPoolId: null,
      trackingMode: sku?.trackingMode ?? InventoryTrackingMode.POOLED,
      available: false,
      requestedQuantity: quantity,
      totalCapacity: 0,
      blockedQuantity: 0,
      reservedQuantity: 0,
      remainingQuantity: 0,
      rentalRange: { start: this.formatDate(rentalStart), end: this.formatDate(rentalEnd) },
      effectiveBlockedRange: { start: this.formatDate(rentalStart), end: this.formatDate(rentalEnd) },
      availabilityPolicy: null,
      reason,
    };
  }
}
