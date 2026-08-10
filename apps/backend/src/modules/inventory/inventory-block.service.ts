import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryBlockType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInventoryBlockDto,
  InventoryBlocksQueryDto,
} from './dto/inventory-block.dto';

const MANUAL_BLOCK_TYPES: InventoryBlockType[] = [
  InventoryBlockType.MANUAL,
  InventoryBlockType.LOCATION_BLACKOUT,
  InventoryBlockType.SKU_BLACKOUT,
];

@Injectable()
export class InventoryBlockService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: InventoryBlocksQueryDto) {
    const where: Prisma.InventoryBlockWhereInput = {
      tenantId,
      ...(query.blockType ? { blockType: query.blockType } : {}),
      AND: [
        ...(query.productId
          ? [{ OR: [
              { productId: query.productId },
              { variant: { productId: query.productId } },
              { variantSize: { variant: { productId: query.productId } } },
              { stockUnit: { variantSize: { variant: { productId: query.productId } } } },
              { inventoryPool: { variantSize: { variant: { productId: query.productId } } } },
            ] }]
          : []),
        ...(query.locationId
          ? [{ OR: [
              { locationId: query.locationId },
              { stockUnit: { locationId: query.locationId } },
              { inventoryPool: { locationId: query.locationId } },
            ] }]
          : []),
        ...(query.variantSizeId
          ? [{ OR: [
              { variantSizeId: query.variantSizeId },
              { stockUnit: { variantSizeId: query.variantSizeId } },
              { inventoryPool: { variantSizeId: query.variantSizeId } },
            ] }]
          : []),
      ],
      ...(query.stockUnitId ? { stockUnitId: query.stockUnitId } : {}),
      ...(query.inventoryPoolId ? { inventoryPoolId: query.inventoryPoolId } : {}),
      ...(query.from ? { endDate: { gte: this.date(query.from, 'from') } } : {}),
      ...(query.to ? { startDate: { lte: this.date(query.to, 'to') } } : {}),
      ...(!query.from && query.activeOnly ? { endDate: { gte: this.today() } } : {}),
    };
    if (query.from && query.to && this.date(query.from, 'from') > this.date(query.to, 'to')) {
      throw new BadRequestException('from must be on or before to');
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.inventoryBlock.count({ where }),
      this.prisma.inventoryBlock.findMany({
        where,
        include: this.include(),
        orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: data.map((block) => this.project(block)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async preview(tenantId: string, dto: CreateInventoryBlockDto) {
    const target = await this.validate(tenantId, dto);
    const startDate = this.date(dto.startDate, 'startDate');
    const endDate = this.date(dto.endDate, 'endDate');
    const reservationWhere = this.reservationWhere(tenantId, dto, startDate, endDate);
    const [aggregate, bookings] = await Promise.all([
      this.prisma.inventoryReservation.aggregate({
        where: reservationWhere,
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      this.prisma.inventoryReservation.findMany({
        where: reservationWhere,
        distinct: ['bookingId'],
        select: { booking: { select: { id: true, bookingNumber: true, status: true } } },
        orderBy: { blockedStartDate: 'asc' },
        take: 20,
      }),
    ]);
    return {
      target,
      dateRange: { start: dto.startDate, end: dto.endDate },
      quantity: dto.quantity ?? null,
      affectedReservations: aggregate._count._all,
      affectedQuantity: aggregate._sum.quantity ?? 0,
      affectedBookings: bookings.map(({ booking }) => booking),
      warning:
        aggregate._count._all > 0
          ? 'This block overlaps active rental commitments. Resolve or re-plan those bookings after creating it.'
          : null,
    };
  }

  async create(tenantId: string, dto: CreateInventoryBlockDto, actorUserId?: string) {
    const preview = await this.preview(tenantId, dto);
    const block = await this.prisma.inventoryBlock.create({
      data: {
        tenantId,
        productId: dto.productId ?? null,
        variantId: dto.variantId ?? null,
        variantSizeId: dto.variantSizeId ?? null,
        stockUnitId: dto.stockUnitId ?? null,
        locationId: dto.locationId ?? null,
        inventoryPoolId: dto.inventoryPoolId ?? null,
        quantity: dto.quantity ?? null,
        startDate: this.date(dto.startDate, 'startDate'),
        endDate: this.date(dto.endDate, 'endDate'),
        blockType: dto.blockType,
        reason: dto.reason.trim(),
        createdByUserId: actorUserId ?? null,
      },
      include: this.include(),
    });
    return { block: this.project(block), preview };
  }

  async remove(tenantId: string, blockId: string) {
    const block = await this.prisma.inventoryBlock.findFirst({
      where: { id: blockId, tenantId },
      include: { serviceOrder: { select: { id: true } }, inspection: { select: { id: true } }, transferLine: { select: { id: true } } },
    });
    if (!block) throw new NotFoundException('Inventory block not found');
    if (!this.canDelete(block)) {
      throw new BadRequestException(
        'This block is owned by an inspection, service order, transfer, or lifecycle workflow. Complete or cancel that workflow instead.',
      );
    }
    await this.prisma.inventoryBlock.delete({ where: { id: block.id } });
    return { message: 'Inventory block removed' };
  }

  private async validate(tenantId: string, dto: CreateInventoryBlockDto) {
    if (!MANUAL_BLOCK_TYPES.includes(dto.blockType)) {
      throw new BadRequestException('Operational blocks must be created by their owning workflow');
    }
    const scopeIds = [
      dto.productId,
      dto.variantId,
      dto.variantSizeId,
      dto.stockUnitId,
      dto.locationId,
      dto.inventoryPoolId,
    ].filter(Boolean);
    if (scopeIds.length !== 1) {
      throw new BadRequestException('Exactly one inventory block target is required');
    }
    if (this.date(dto.startDate, 'startDate') > this.date(dto.endDate, 'endDate')) {
      throw new BadRequestException('Start date must be on or before end date');
    }
    if (dto.blockType === InventoryBlockType.LOCATION_BLACKOUT && !dto.locationId) {
      throw new BadRequestException('A location blackout must target one location');
    }
    if (dto.blockType === InventoryBlockType.SKU_BLACKOUT && !dto.variantSizeId) {
      throw new BadRequestException('A SKU blackout must target one SKU');
    }
    if (dto.blockType === InventoryBlockType.MANUAL && dto.locationId) {
      throw new BadRequestException('Use LOCATION_BLACKOUT for a location-wide block');
    }
    if (dto.quantity !== undefined && !dto.inventoryPoolId) {
      throw new BadRequestException('A partial quantity block must target one pooled inventory record');
    }

    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, tenantId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!product) throw new NotFoundException('Product not found');
      return { kind: 'PRODUCT', ...product };
    }
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: dto.variantId, tenantId, product: { deletedAt: null } },
        select: { id: true, variantName: true, product: { select: { id: true, name: true } } },
      });
      if (!variant) throw new NotFoundException('Product variant not found');
      return { kind: 'VARIANT', ...variant };
    }
    if (dto.variantSizeId) {
      const sku = await this.prisma.variantSize.findFirst({
        where: { id: dto.variantSizeId, tenantId, variant: { product: { deletedAt: null } } },
        select: { id: true, sizeInstance: { select: { displayLabel: true } }, variant: { select: { variantName: true, product: { select: { id: true, name: true } } } } },
      });
      if (!sku) throw new NotFoundException('Variant-size inventory not found');
      return { kind: 'SKU', ...sku };
    }
    if (dto.stockUnitId) {
      const unit = await this.prisma.stockUnit.findFirst({
        where: { id: dto.stockUnitId, tenantId, deletedAt: null },
        select: { id: true, assetCode: true, location: { select: { id: true, name: true } }, variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } } },
      });
      if (!unit) throw new NotFoundException('Physical item not found');
      return { kind: 'STOCK_UNIT', ...unit };
    }
    if (dto.locationId) {
      const location = await this.prisma.inventoryLocation.findFirst({
        where: { id: dto.locationId, tenantId },
        select: { id: true, code: true, name: true, isActive: true },
      });
      if (!location) throw new NotFoundException('Inventory location not found');
      return { kind: 'LOCATION', ...location };
    }
    const pool = await this.prisma.inventoryPool.findFirst({
      where: { id: dto.inventoryPoolId, tenantId },
      select: { id: true, onHandQuantity: true, location: { select: { id: true, code: true, name: true } }, variantSize: { select: { id: true, sizeInstance: { select: { displayLabel: true } }, variant: { select: { variantName: true, product: { select: { id: true, name: true } } } } } } },
    });
    if (!pool) throw new NotFoundException('Pooled inventory record not found');
    if (dto.quantity !== undefined && dto.quantity > pool.onHandQuantity) {
      throw new BadRequestException('Blocked quantity cannot exceed current on-hand quantity');
    }
    return { kind: 'INVENTORY_POOL', ...pool };
  }

  private reservationWhere(
    tenantId: string,
    dto: CreateInventoryBlockDto,
    startDate: Date,
    endDate: Date,
  ): Prisma.InventoryReservationWhereInput {
    const target: Prisma.InventoryReservationWhereInput = dto.productId
      ? { productId: dto.productId }
      : dto.variantId
        ? { variantSize: { variantId: dto.variantId } }
        : dto.variantSizeId
          ? { variantSizeId: dto.variantSizeId }
          : dto.stockUnitId
            ? { OR: [{ preferredStockUnitId: dto.stockUnitId }, { assignments: { some: { stockUnitId: dto.stockUnitId, releasedAt: null } } }] }
            : dto.locationId
              ? { sourceLocationId: dto.locationId }
              : { inventoryPoolId: dto.inventoryPoolId };
    return {
      tenantId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      blockedStartDate: { lte: endDate },
      blockedEndDate: { gte: startDate },
      ...target,
    };
  }

  private include() {
    return {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, variantName: true, product: { select: { id: true, name: true } } } },
      variantSize: { select: { id: true, sizeInstance: { select: { displayLabel: true } }, variant: { select: { variantName: true, product: { select: { id: true, name: true } } } } } },
      stockUnit: { select: { id: true, assetCode: true, location: { select: { id: true, code: true, name: true } }, variantSize: { select: { sizeInstance: { select: { displayLabel: true } }, variant: { select: { variantName: true, product: { select: { id: true, name: true } } } } } } } },
      location: { select: { id: true, code: true, name: true } },
      inventoryPool: { select: { id: true, onHandQuantity: true, location: { select: { id: true, code: true, name: true } }, variantSize: { select: { id: true, sizeInstance: { select: { displayLabel: true } }, variant: { select: { variantName: true, product: { select: { id: true, name: true } } } } } } } },
      createdByUser: { select: { id: true, fullName: true } },
      serviceOrder: { select: { id: true } },
      inspection: { select: { id: true } },
      transferLine: { select: { id: true, transfer: { select: { id: true, transferNumber: true } } } },
    } satisfies Prisma.InventoryBlockInclude;
  }

  private project<T extends { blockType: InventoryBlockType; serviceOrder: unknown; inspection: unknown; transferLine: unknown }>(block: T) {
    return { ...block, canDelete: this.canDelete(block), owner: block.serviceOrder ? 'SERVICE_ORDER' : block.inspection ? 'INSPECTION' : block.transferLine ? 'TRANSFER' : 'MANUAL' };
  }

  private canDelete(block: { blockType: InventoryBlockType; serviceOrder: unknown; inspection: unknown; transferLine: unknown }) {
    return MANUAL_BLOCK_TYPES.includes(block.blockType) && !block.serviceOrder && !block.inspection && !block.transferLine;
  }

  private date(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }

  private today() {
    const value = new Date();
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
