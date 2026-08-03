import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryTrackingMode,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type InventoryDatabase = Prisma.TransactionClient;

export interface InventoryAvailabilityInput {
  tenantId: string;
  productId: string;
  variantSizeId: string;
  startDate: string | Date;
  endDate: string | Date;
  quantity?: number;
  enforcePublished?: boolean;
}

export interface InventoryAvailabilityResult {
  productId: string;
  variantId: string;
  variantSizeId: string;
  sizeInstanceId: string;
  trackingMode: InventoryTrackingMode;
  available: boolean;
  requestedQuantity: number;
  totalCapacity: number;
  reservedQuantity: number;
  remainingQuantity: number;
  rentalRange: { start: string; end: string };
  effectiveBlockedRange: { start: string; end: string };
  reason?: string;
}

@Injectable()
export class InventoryAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async check(
    input: InventoryAvailabilityInput,
    transaction?: InventoryDatabase,
  ): Promise<InventoryAvailabilityResult> {
    const db = transaction ?? this.prisma;
    const quantity = input.quantity ?? 1;
    const rentalStart = this.parseDate(input.startDate, 'startDate');
    const rentalEnd = this.parseDate(input.endDate, 'endDate');

    if (rentalStart > rentalEnd) {
      return this.unavailableResult(input, {
        variantId: '',
        sizeInstanceId: '',
        trackingMode: InventoryTrackingMode.POOLED,
        quantity,
        rentalStart,
        rentalEnd,
        blockedStart: rentalStart,
        blockedEnd: rentalEnd,
        reason: 'Start date must be on or before end date',
      });
    }

    const sku = await db.variantSize.findFirst({
      where: {
        id: input.variantSizeId,
        tenantId: input.tenantId,
        variant: { productId: input.productId },
      },
      select: {
        id: true,
        tenantId: true,
        variantId: true,
        sizeInstanceId: true,
        trackingMode: true,
        pooledQuantity: true,
        variant: {
          select: {
            product: {
              select: {
                id: true,
                status: true,
                isAvailable: true,
                availableFrom: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!sku) {
      throw new NotFoundException('Variant-size inventory was not found');
    }

    const bufferDays = await this.getBufferDays(db, input.tenantId);
    const blockedStart = this.addDays(rentalStart, -bufferDays);
    const blockedEnd = this.addDays(rentalEnd, bufferDays);
    const product = sku.variant.product;

    if (product.deletedAt) {
      return this.unavailableResult(input, {
        ...sku,
        quantity,
        rentalStart,
        rentalEnd,
        blockedStart,
        blockedEnd,
        reason: 'Product is not available',
      });
    }

    if (input.enforcePublished !== false && product.status !== ProductStatus.published) {
      return this.unavailableResult(input, {
        ...sku,
        quantity,
        rentalStart,
        rentalEnd,
        blockedStart,
        blockedEnd,
        reason: 'Product is not published',
      });
    }

    if (!product.isAvailable || (product.availableFrom && product.availableFrom > rentalStart)) {
      return this.unavailableResult(input, {
        ...sku,
        quantity,
        rentalStart,
        rentalEnd,
        blockedStart,
        blockedEnd,
        reason: 'Product is currently unavailable',
      });
    }

    const [legacyBlock, scopedBlock] = await Promise.all([
      db.dateBlock.findFirst({
        where: {
          tenantId: input.tenantId,
          productId: input.productId,
          startDate: { lte: blockedEnd },
          endDate: { gte: blockedStart },
        },
        select: { id: true },
      }),
      db.inventoryBlock.findFirst({
        where: {
          tenantId: input.tenantId,
          startDate: { lte: blockedEnd },
          endDate: { gte: blockedStart },
          OR: [
            { productId: input.productId },
            { variantId: sku.variantId },
            { variantSizeId: sku.id },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (legacyBlock || scopedBlock) {
      return this.unavailableResult(input, {
        ...sku,
        quantity,
        rentalStart,
        rentalEnd,
        blockedStart,
        blockedEnd,
        reason: 'Inventory is blocked for the selected dates',
      });
    }

    const [totalCapacity, reservationAggregate] = await Promise.all([
      this.resolveCapacity(
        db,
        input.tenantId,
        sku.id,
        sku.trackingMode,
        sku.pooledQuantity,
        blockedStart,
        blockedEnd,
      ),
      db.inventoryReservation.aggregate({
        where: {
          tenantId: input.tenantId,
          variantSizeId: sku.id,
          blockedStartDate: { lte: blockedEnd },
          blockedEndDate: { gte: blockedStart },
          OR: [
            { status: 'CONFIRMED' },
            {
              status: 'PENDING',
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          ],
        },
        _sum: { quantity: true },
      }),
    ]);

    const reservedQuantity = reservationAggregate._sum.quantity ?? 0;
    const remainingQuantity = Math.max(0, totalCapacity - reservedQuantity);
    const available = quantity > 0 && remainingQuantity >= quantity;

    return {
      productId: input.productId,
      variantId: sku.variantId,
      variantSizeId: sku.id,
      sizeInstanceId: sku.sizeInstanceId,
      trackingMode: sku.trackingMode,
      available,
      requestedQuantity: quantity,
      totalCapacity,
      reservedQuantity,
      remainingQuantity,
      rentalRange: {
        start: this.formatDate(rentalStart),
        end: this.formatDate(rentalEnd),
      },
      effectiveBlockedRange: {
        start: this.formatDate(blockedStart),
        end: this.formatDate(blockedEnd),
      },
      ...(!available ? { reason: 'Requested quantity is not available' } : {}),
    };
  }

  async getEffectiveBlockedRange(
    tenantId: string,
    startDate: string | Date,
    endDate: string | Date,
    transaction?: InventoryDatabase,
  ): Promise<{ rentalStart: Date; rentalEnd: Date; blockedStart: Date; blockedEnd: Date }> {
    const db = transaction ?? this.prisma;
    const rentalStart = this.parseDate(startDate, 'startDate');
    const rentalEnd = this.parseDate(endDate, 'endDate');
    const bufferDays = await this.getBufferDays(db, tenantId);

    return {
      rentalStart,
      rentalEnd,
      blockedStart: this.addDays(rentalStart, -bufferDays),
      blockedEnd: this.addDays(rentalEnd, bufferDays),
    };
  }

  parseDate(value: string | Date, fieldName = 'date'): Date {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private async getBufferDays(db: InventoryDatabase, tenantId: string): Promise<number> {
    const settings = await db.storeSettings.findUnique({
      where: { tenantId },
      select: { bufferDays: true },
    });
    return Math.max(0, settings?.bufferDays ?? 0);
  }

  private async resolveCapacity(
    db: InventoryDatabase,
    tenantId: string,
    variantSizeId: string,
    trackingMode: InventoryTrackingMode,
    pooledQuantity: number,
    blockedStart: Date,
    blockedEnd: Date,
  ): Promise<number> {
    if (trackingMode === InventoryTrackingMode.POOLED) {
      return Math.max(0, pooledQuantity);
    }

    return db.stockUnit.count({
      where: {
        tenantId,
        variantSizeId,
        status: 'ACTIVE',
        condition: { not: 'DAMAGED' },
        deletedAt: null,
        blocks: {
          none: {
            startDate: { lte: blockedEnd },
            endDate: { gte: blockedStart },
          },
        },
      },
    });
  }

  private unavailableResult(
    input: InventoryAvailabilityInput,
    details: {
      variantId: string;
      sizeInstanceId: string;
      trackingMode: InventoryTrackingMode;
      quantity: number;
      rentalStart: Date;
      rentalEnd: Date;
      blockedStart: Date;
      blockedEnd: Date;
      reason: string;
    },
  ): InventoryAvailabilityResult {
    return {
      productId: input.productId,
      variantId: details.variantId,
      variantSizeId: input.variantSizeId,
      sizeInstanceId: details.sizeInstanceId,
      trackingMode: details.trackingMode,
      available: false,
      requestedQuantity: details.quantity,
      totalCapacity: 0,
      reservedQuantity: 0,
      remainingQuantity: 0,
      rentalRange: {
        start: this.formatDate(details.rentalStart),
        end: this.formatDate(details.rentalEnd),
      },
      effectiveBlockedRange: {
        start: this.formatDate(details.blockedStart),
        end: this.formatDate(details.blockedEnd),
      },
      reason: details.reason,
    };
  }

  private addDays(value: Date, days: number): Date {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
