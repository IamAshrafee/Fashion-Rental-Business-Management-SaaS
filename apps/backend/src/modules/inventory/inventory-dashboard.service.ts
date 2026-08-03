import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryItemsQueryDto,
  InventorySkusQueryDto,
} from './dto/inventory-foundation.dto';

@Injectable()
export class InventoryDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const today = this.today();
    const [
      locations,
      pooled,
      unitStates,
      reservationSummary,
      transferStates,
      draftInspections,
      openServiceOrders,
      openIssues,
      overdueRequirements,
      potentialLowStock,
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
          _count: { select: { stockUnits: true, pools: true } },
        },
      }),
      this.prisma.inventoryPool.aggregate({
        where: { tenantId },
        _sum: { onHandQuantity: true },
        _count: { _all: true },
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
      this.prisma.stockUnitInspection.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.inventoryServiceOrder.count({
        where: { tenantId, status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
      }),
      this.prisma.stockUnitIssue.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_SERVICE'] } },
      }),
      this.prisma.fulfillmentRequirement.count({ where: { tenantId, status: 'OVERDUE' } }),
      this.prisma.inventoryPool.findMany({
        where: { tenantId, reorderThreshold: { not: null } },
        include: {
          location: { select: { id: true, code: true, name: true } },
          variantSize: {
            select: {
              id: true,
              sizeInstance: { select: { displayLabel: true } },
              variant: { select: { variantName: true, product: { select: { id: true, name: true } } } },
            },
          },
        },
        take: 500,
      }),
      this.prisma.stockUnit.groupBy({
        by: ['condition'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.stockUnit.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { purchasePrice: true, estimatedCurrentValue: true },
      }),
      this.prisma.inventoryServiceOrder.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _sum: { cost: true },
        _count: { _all: true },
      }),
    ]);
    return {
      locations,
      pooled: {
        poolCount: pooled._count._all,
        onHandQuantity: pooled._sum.onHandQuantity ?? 0,
      },
      serialized: unitStates,
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
      },
      lowStock: potentialLowStock.filter(
        (pool) => pool.reorderThreshold !== null && pool.onHandQuantity <= pool.reorderThreshold,
      ),
      conditionSummary,
      economics: {
        acquisitionCost: unitEconomics._sum.purchasePrice ?? 0,
        estimatedCurrentValue: unitEconomics._sum.estimatedCurrentValue ?? 0,
        completedServiceCost: serviceEconomics._sum.cost ?? 0,
        completedServiceOrders: serviceEconomics._count._all,
      },
    };
  }

  async listSkus(tenantId: string, query: InventorySkusQueryDto) {
    const search = query.search?.trim();
    const locationClause = query.locationId
      ? Prisma.sql`AND location_id = ${query.locationId}`
      : Prisma.empty;
    const searchClause = search
      ? Prisma.sql`AND (
          p.name ILIKE ${`%${search}%`}
          OR COALESCE(pv.variant_name, '') ILIKE ${`%${search}%`}
          OR si.display_label ILIKE ${`%${search}%`}
        )`
      : Prisma.empty;
    const trackingClause = query.trackingMode
      ? Prisma.sql`AND vs.tracking_mode = ${query.trackingMode}::"InventoryTrackingMode"`
      : Prisma.empty;
    const stockStateClause = query.stockState
      ? Prisma.sql`AND inventory_state = ${query.stockState}`
      : Prisma.empty;
    const orderDirection = query.order === 'desc' ? Prisma.raw('DESC') : Prisma.raw('ASC');
    const orderColumn = {
      PRODUCT: Prisma.raw('product_name'),
      ON_HAND: Prisma.raw('on_hand_quantity'),
      AVAILABLE: Prisma.raw('available_quantity'),
      RESERVED: Prisma.raw('reserved_quantity'),
    }[query.sort ?? 'PRODUCT'];

    type SkuRow = {
      id: string;
      trackingMode: 'POOLED' | 'SERIALIZED';
      productId: string;
      productName: string;
      productStatus: string;
      variantId: string;
      variantName: string | null;
      sizeLabel: string;
      poolCount: bigint;
      serializedCount: bigint;
      activeUnitCount: bigint;
      availableUnitCount: bigint;
      onHandQuantity: bigint;
      reservedQuantity: bigint;
      availableQuantity: bigint;
      inventoryState: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'UNCONFIGURED';
      fullCount: bigint;
    };

    const rows = await this.prisma.$queryRaw<SkuRow[]>(Prisma.sql`
      WITH pool_stock AS (
        SELECT
          variant_size_id,
          COUNT(*)::bigint AS pool_count,
          COALESCE(SUM(on_hand_quantity), 0)::bigint AS on_hand_quantity,
          BOOL_OR(reorder_threshold IS NOT NULL AND on_hand_quantity <= reorder_threshold) AS low_stock
        FROM inventory_pools
        WHERE tenant_id = ${tenantId} ${locationClause}
        GROUP BY variant_size_id
      ),
      unit_stock AS (
        SELECT
          variant_size_id,
          COUNT(*)::bigint AS serialized_count,
          COUNT(*) FILTER (WHERE disposition = 'ACTIVE')::bigint AS active_unit_count,
          COUNT(*) FILTER (
            WHERE disposition = 'ACTIVE' AND operational_state = 'AVAILABLE'
          )::bigint AS available_unit_count
        FROM stock_units
        WHERE tenant_id = ${tenantId} AND deleted_at IS NULL ${locationClause}
        GROUP BY variant_size_id
      ),
      reservation_stock AS (
        SELECT
          variant_size_id,
          COALESCE(SUM(quantity), 0)::bigint AS reserved_quantity
        FROM inventory_reservations
        WHERE tenant_id = ${tenantId}
          AND status IN ('PENDING', 'CONFIRMED')
          AND blocked_start_date <= CURRENT_DATE
          AND blocked_end_date >= CURRENT_DATE
          AND (status = 'CONFIRMED' OR expires_at IS NULL OR expires_at > NOW())
          ${query.locationId ? Prisma.sql`AND source_location_id = ${query.locationId}` : Prisma.empty}
        GROUP BY variant_size_id
      ),
      sku_metrics AS (
        SELECT
          vs.id,
          vs.tracking_mode,
          p.id AS product_id,
          p.name AS product_name,
          p.status::text AS product_status,
          pv.id AS variant_id,
          pv.variant_name,
          si.display_label AS size_label,
          COALESCE(ps.pool_count, 0)::bigint AS pool_count,
          COALESCE(us.serialized_count, 0)::bigint AS serialized_count,
          COALESCE(us.active_unit_count, 0)::bigint AS active_unit_count,
          COALESCE(us.available_unit_count, 0)::bigint AS available_unit_count,
          CASE
            WHEN vs.tracking_mode = 'POOLED' THEN COALESCE(ps.on_hand_quantity, 0)
            ELSE COALESCE(us.active_unit_count, 0)
          END::bigint AS on_hand_quantity,
          COALESCE(rs.reserved_quantity, 0)::bigint AS reserved_quantity,
          GREATEST(
            0,
            CASE
              WHEN vs.tracking_mode = 'POOLED' THEN COALESCE(ps.on_hand_quantity, 0)
              ELSE COALESCE(us.available_unit_count, 0)
            END - COALESCE(rs.reserved_quantity, 0)
          )::bigint AS available_quantity,
          CASE
            WHEN (vs.tracking_mode = 'POOLED' AND COALESCE(ps.pool_count, 0) = 0)
              OR (vs.tracking_mode = 'SERIALIZED' AND COALESCE(us.serialized_count, 0) = 0)
              THEN 'UNCONFIGURED'
            WHEN GREATEST(
              0,
              CASE
                WHEN vs.tracking_mode = 'POOLED' THEN COALESCE(ps.on_hand_quantity, 0)
                ELSE COALESCE(us.available_unit_count, 0)
              END - COALESCE(rs.reserved_quantity, 0)
            ) = 0 THEN 'UNAVAILABLE'
            WHEN vs.tracking_mode = 'POOLED' AND COALESCE(ps.low_stock, false)
              THEN 'LOW_STOCK'
            ELSE 'AVAILABLE'
          END AS inventory_state
        FROM variant_sizes vs
        JOIN product_variants pv ON pv.id = vs.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN size_instances si ON si.id = vs.size_instance_id
        LEFT JOIN pool_stock ps ON ps.variant_size_id = vs.id
        LEFT JOIN unit_stock us ON us.variant_size_id = vs.id
        LEFT JOIN reservation_stock rs ON rs.variant_size_id = vs.id
        WHERE vs.tenant_id = ${tenantId}
          AND p.deleted_at IS NULL
          ${searchClause}
          ${trackingClause}
      )
      SELECT
        id,
        tracking_mode AS "trackingMode",
        product_id AS "productId",
        product_name AS "productName",
        product_status AS "productStatus",
        variant_id AS "variantId",
        variant_name AS "variantName",
        size_label AS "sizeLabel",
        pool_count AS "poolCount",
        serialized_count AS "serializedCount",
        active_unit_count AS "activeUnitCount",
        available_unit_count AS "availableUnitCount",
        on_hand_quantity AS "onHandQuantity",
        reserved_quantity AS "reservedQuantity",
        available_quantity AS "availableQuantity",
        inventory_state AS "inventoryState",
        COUNT(*) OVER()::bigint AS "fullCount"
      FROM sku_metrics
      WHERE TRUE ${stockStateClause}
      ORDER BY ${orderColumn} ${orderDirection}, product_name ASC, id ASC
      OFFSET ${(query.page - 1) * query.limit}
      LIMIT ${query.limit}
    `);

    const total = rows.length ? Number(rows[0].fullCount) : 0;
    return {
      data: rows.map(({ fullCount: _fullCount, ...row }) => ({
        ...row,
        poolCount: Number(row.poolCount),
        serializedCount: Number(row.serializedCount),
        activeUnitCount: Number(row.activeUnitCount),
        availableUnitCount: Number(row.availableUnitCount),
        onHandQuantity: Number(row.onHandQuantity),
        reservedQuantity: Number(row.reservedQuantity),
        availableQuantity: Number(row.availableQuantity),
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async listItems(tenantId: string, query: InventoryItemsQueryDto) {
    const where: Prisma.StockUnitWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.disposition ? { disposition: query.disposition } : {}),
      ...(query.operationalState ? { operationalState: query.operationalState } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { assetCode: { contains: query.search.trim(), mode: 'insensitive' } },
              { barcode: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                variantSize: {
                  variant: { product: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
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
              serviceOrders: { where: { status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } } },
            },
          },
        },
        orderBy: [{ operationalState: 'asc' }, { assetCode: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.stockUnit.count({ where }),
    ]);
    const metrics = data.length
      ? await this.prisma.$queryRaw<
          Array<{
            stock_unit_id: string;
            completed_rentals: bigint;
            total_rental_days: bigint;
          }>
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
        `)
      : [];
    const metricsByUnit = new Map(
      metrics.map((item) => [
        item.stock_unit_id,
        {
          completedRentals: Number(item.completed_rentals),
          totalRentalDays: Number(item.total_rental_days),
        },
      ]),
    );
    return {
      data: data.map((item) => ({
        ...item,
        rentalMetrics: metricsByUnit.get(item.id) ?? {
          completedRentals: 0,
          totalRentalDays: 0,
        },
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async operations(tenantId: string) {
    const [inspections, serviceOrders, issues] = await Promise.all([
      this.prisma.stockUnitInspection.findMany({
        where: { tenantId, status: 'DRAFT' },
        include: {
          stockUnit: {
            include: {
              location: { select: { id: true, code: true, name: true } },
              variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } },
            },
          },
          inspectedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      this.prisma.inventoryServiceOrder.findMany({
        where: { tenantId, status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
        include: {
          stockUnit: { select: { id: true, assetCode: true, variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } } } },
          serviceLocation: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ expectedCompletionAt: 'asc' }, { requestedAt: 'asc' }],
        take: 100,
      }),
      this.prisma.stockUnitIssue.findMany({
        where: { tenantId, status: { in: ['OPEN', 'IN_SERVICE'] } },
        include: {
          stockUnit: { select: { id: true, assetCode: true, variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } } } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
        take: 100,
      }),
    ]);
    return { inspections, serviceOrders, issues };
  }

  private today() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
