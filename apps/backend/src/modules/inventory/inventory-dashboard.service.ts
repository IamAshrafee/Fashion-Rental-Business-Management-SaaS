import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryItemsQueryDto, InventorySkusQueryDto } from './dto/inventory-foundation.dto';

@Injectable()
export class InventoryDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const today = this.today();
    const [
      locations,
      unitStates,
      reservationSummary,
      transferStates,
      overdueTransfers,
      draftInspections,
      openServiceOrders,
      openIssues,
      overdueRequirements,
      conditionSummary,
      unitEconomics,
      serviceEconomics,
    ] = await Promise.all([
      this.prisma.inventoryLocation.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          locationType: true,
          isDefault: true,
          _count: { select: { stockUnits: true } },
        },
      }),
      this.prisma.stockUnit.groupBy({
        by: ['disposition', 'operationalState'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.inventoryReservation.aggregate({
        where: {
          tenantId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          blockedEndDate: { gte: today },
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      this.prisma.inventoryTransfer.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.inventoryTransfer.count({
        where: {
          tenantId,
          status: { in: ['READY', 'DISPATCHED', 'PARTIALLY_RECEIVED'] },
          expectedArrivalAt: { lt: new Date() },
        },
      }),
      this.prisma.stockUnitInspection.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.inventoryServiceOrder.count({
        where: { tenantId, status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
      }),
      this.prisma.stockUnitIssue.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_SERVICE'] } },
      }),
      this.prisma.fulfillmentRequirement.count({ where: { tenantId, status: 'OVERDUE' } }),
      this.prisma.stockUnit.groupBy({
        by: ['condition'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.stockUnit.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { acquisitionCost: true, estimatedCurrentValue: true },
      }),
      this.prisma.inventoryServiceOrder.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _sum: { cost: true },
        _count: { _all: true },
      }),
    ]);

    return {
      locations,
      physicalItems: unitStates,
      reservations: {
        reservationCount: reservationSummary._count._all,
        quantity: reservationSummary._sum.quantity ?? 0,
      },
      transfers: Object.fromEntries(
        transferStates.map((entry) => [entry.status, entry._count._all]),
      ),
      workQueues: {
        draftInspections,
        openServiceOrders,
        openIssues,
        overdueRequirements,
        overdueTransfers,
      },
      conditionSummary,
      economics: {
        acquisitionCost: unitEconomics._sum.acquisitionCost ?? 0,
        estimatedCurrentValue: unitEconomics._sum.estimatedCurrentValue ?? 0,
        completedServiceCost: serviceEconomics._sum.cost ?? 0,
        completedServiceOrders: serviceEconomics._count._all,
      },
    };
  }

  async listSkus(tenantId: string, query: InventorySkusQueryDto) {
    const search = query.search?.trim();
    const today = this.today();
    const skus = await this.prisma.variantSize.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                {
                  variant: {
                    product: { name: { contains: search, mode: 'insensitive' as const } },
                  },
                },
                { variant: { variantName: { contains: search, mode: 'insensitive' as const } } },
                {
                  sizeInstance: {
                    displayLabel: { contains: search, mode: 'insensitive' as const },
                  },
                },
              ],
            }
          : {}),
        variant: {
          product: {
            deletedAt: null,
            ...(query.productId ? { id: query.productId } : {}),
          },
        },
      },
      select: {
        id: true,
        variant: {
          select: {
            id: true,
            variantName: true,
            product: { select: { id: true, name: true, status: true } },
          },
        },
        sizeInstance: { select: { displayLabel: true } },
        stockUnits: {
          where: {
            deletedAt: null,
            ...(query.locationId ? { locationId: query.locationId } : {}),
          },
          select: { disposition: true, operationalState: true },
        },
        inventoryReservations: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            blockedStartDate: { lte: today },
            blockedEndDate: { gte: today },
            ...(query.locationId ? { sourceLocationId: query.locationId } : {}),
          },
          select: { quantity: true },
        },
      },
    });

    const rows = skus
      .map((sku) => {
        const physicalItemCount = sku.stockUnits.length;
        const activeItemCount = sku.stockUnits.filter(
          (unit) => unit.disposition === 'ACTIVE',
        ).length;
        const operationallyAvailableCount = sku.stockUnits.filter(
          (unit) => unit.disposition === 'ACTIVE' && unit.operationalState === 'AVAILABLE',
        ).length;
        const reservedQuantity = sku.inventoryReservations.reduce(
          (sum, row) => sum + row.quantity,
          0,
        );
        const availableQuantity = Math.max(0, operationallyAvailableCount - reservedQuantity);
        const inventoryState =
          physicalItemCount === 0
            ? 'UNCONFIGURED'
            : availableQuantity === 0
              ? 'UNAVAILABLE'
              : 'AVAILABLE';
        return {
          id: sku.id,
          productId: sku.variant.product.id,
          productName: sku.variant.product.name,
          productStatus: sku.variant.product.status,
          variantId: sku.variant.id,
          variantName: sku.variant.variantName,
          sizeLabel: sku.sizeInstance.displayLabel,
          physicalItemCount,
          activeItemCount,
          operationallyAvailableCount,
          onHandQuantity: activeItemCount,
          reservedQuantity,
          availableQuantity,
          inventoryState,
        };
      })
      .filter((row) => !query.stockState || row.inventoryState === query.stockState);

    const key = query.sort ?? 'PRODUCT';
    const direction = query.order === 'desc' ? -1 : 1;
    rows.sort((left, right) => {
      const leftValue =
        key === 'PRODUCT'
          ? left.productName
          : key === 'ON_HAND'
            ? left.onHandQuantity
            : key === 'AVAILABLE'
              ? left.availableQuantity
              : left.reservedQuantity;
      const rightValue =
        key === 'PRODUCT'
          ? right.productName
          : key === 'ON_HAND'
            ? right.onHandQuantity
            : key === 'AVAILABLE'
              ? right.availableQuantity
              : right.reservedQuantity;
      return (
        (typeof leftValue === 'string'
          ? leftValue.localeCompare(String(rightValue))
          : Number(leftValue) - Number(rightValue)) * direction
      );
    });
    const total = rows.length;
    const start = (query.page - 1) * query.limit;
    return {
      data: rows.slice(start, start + query.limit),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async listItems(tenantId: string, query: InventoryItemsQueryDto) {
    if (Boolean(query.availableFrom) !== Boolean(query.availableTo)) {
      throw new BadRequestException('Both availableFrom and availableTo are required');
    }
    const availableFrom = query.availableFrom ? this.date(query.availableFrom) : null;
    const availableTo = query.availableTo ? this.date(query.availableTo) : null;
    if (availableFrom && availableTo && availableFrom > availableTo) {
      throw new BadRequestException('availableFrom must be on or before availableTo');
    }
    const attentionWhere: Prisma.StockUnitWhereInput | null =
      query.attention === 'OPEN_ISSUE'
        ? { issues: { some: { status: { in: ['OPEN', 'IN_SERVICE'] } } } }
        : query.attention === 'OPEN_SERVICE'
          ? {
              serviceOrders: {
                some: { status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
              },
            }
          : query.attention === 'INCOMPLETE_SET'
            ? {
                componentStates: {
                  some: {
                    setComponentDefinition: { isActive: true, absenceBlocksRental: true },
                    presence: { in: ['MISSING', 'DAMAGED'] },
                  },
                },
              }
            : null;
    const dateEligibility: Prisma.StockUnitWhereInput | null =
      availableFrom && availableTo
        ? {
            disposition: 'ACTIVE',
            operationalState: 'AVAILABLE',
            blocks: { none: { startDate: { lte: availableTo }, endDate: { gte: availableFrom } } },
            assignments: {
              none: {
                releasedAt: null,
                blockedStartDate: { lte: availableTo },
                blockedEndDate: { gte: availableFrom },
              },
            },
          }
        : null;
    const where: Prisma.StockUnitWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.disposition ? { disposition: query.disposition } : {}),
      ...(query.operationalState ? { operationalState: query.operationalState } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.productId ? { variantSize: { variant: { productId: query.productId } } } : {}),
      ...(query.variantSizeId ? { variantSizeId: query.variantSizeId } : {}),
      AND: [
        ...(attentionWhere ? [attentionWhere] : []),
        ...(dateEligibility ? [dateEligibility] : []),
      ],
      ...(query.search?.trim()
        ? {
            OR: [
              { assetCode: { contains: query.search.trim(), mode: 'insensitive' } },
              { barcode: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                variantSize: {
                  variant: {
                    product: { name: { contains: query.search.trim(), mode: 'insensitive' } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.stockUnit.findMany({
        where,
        include: {
          location: { select: { id: true, code: true, name: true } },
          variantSize: {
            select: {
              id: true,
              sizeInstance: { select: { displayLabel: true } },
              variant: {
                select: {
                  id: true,
                  variantName: true,
                  product: { select: { id: true, name: true } },
                },
              },
            },
          },
          _count: {
            select: {
              inspections: true,
              issues: { where: { status: { in: ['OPEN', 'IN_SERVICE'] } } },
              serviceOrders: {
                where: { status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
              },
            },
          },
          componentStates: {
            where: {
              setComponentDefinition: { isActive: true, absenceBlocksRental: true },
              presence: { in: ['MISSING', 'DAMAGED'] },
            },
            select: { id: true },
          },
        },
        orderBy: [{ operationalState: 'asc' }, { assetCode: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.stockUnit.count({ where }),
    ]);
    const metrics =
      data.length === 0
        ? []
        : await this.prisma.$queryRaw<
            Array<{ stock_unit_id: string; completed_rentals: bigint; total_rental_days: bigint }>
          >(Prisma.sql`
        SELECT
          sua.stock_unit_id,
          COUNT(*)::bigint AS completed_rentals,
          COALESCE(SUM(bi.rental_days), 0)::bigint AS total_rental_days
        FROM stock_unit_assignments sua
        JOIN inventory_reservations ir ON ir.id = sua.reservation_id
        JOIN booking_items bi ON bi.id = ir.booking_item_id
        JOIN bookings b ON b.id = ir.booking_id
        WHERE sua.tenant_id = ${tenantId}
          AND sua.stock_unit_id IN (${Prisma.join(data.map((item) => item.id))})
          AND b.status = 'completed'
        GROUP BY sua.stock_unit_id
      `);
    const metricsByStockUnitId = new Map(metrics.map((metric) => [metric.stock_unit_id, metric]));
    return {
      data: data.map((item) => ({
        ...item,
        componentComplete: item.componentStates.length === 0,
        rentalMetrics: {
          completedRentals: Number(metricsByStockUnitId.get(item.id)?.completed_rentals ?? 0),
          totalRentalDays: Number(metricsByStockUnitId.get(item.id)?.total_rental_days ?? 0),
        },
        lastRental: null,
        nextRental: null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  private today() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private date(value: string) {
    const parsed = new Date(value);
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
}
