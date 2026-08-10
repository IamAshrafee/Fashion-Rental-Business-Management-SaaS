import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryAvailabilityService } from './inventory-availability.service';
import {
  InventoryItemsQueryDto,
  InventorySkusQueryDto,
} from './dto/inventory-foundation.dto';

@Injectable()
export class InventoryDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability?: InventoryAvailabilityService,
  ) {}

  async overview(tenantId: string) {
    const today = this.today();
    const [
      locations,
      pooled,
      unitStates,
      reservationSummary,
      transferStates,
      overdueTransfers,
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
        overdueTransfers,
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
      nextReservedStart: Date | null;
      peakReservedQuantity: bigint;
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
      reservation_events AS (
        SELECT variant_size_id, GREATEST(blocked_start_date, CURRENT_DATE) AS event_date, quantity::bigint AS delta
        FROM inventory_reservations
        WHERE tenant_id = ${tenantId}
          AND status IN ('PENDING', 'CONFIRMED')
          AND blocked_end_date >= CURRENT_DATE
          AND (status = 'CONFIRMED' OR expires_at IS NULL OR expires_at > NOW())
          ${query.locationId ? Prisma.sql`AND source_location_id = ${query.locationId}` : Prisma.empty}
        UNION ALL
        SELECT variant_size_id, blocked_end_date + 1 AS event_date, (-quantity)::bigint AS delta
        FROM inventory_reservations
        WHERE tenant_id = ${tenantId}
          AND status IN ('PENDING', 'CONFIRMED')
          AND blocked_end_date >= CURRENT_DATE
          AND (status = 'CONFIRMED' OR expires_at IS NULL OR expires_at > NOW())
          ${query.locationId ? Prisma.sql`AND source_location_id = ${query.locationId}` : Prisma.empty}
      ),
      reservation_pressure_points AS (
        SELECT
          variant_size_id,
          event_date,
          delta,
          SUM(delta) OVER (PARTITION BY variant_size_id ORDER BY event_date, delta ASC ROWS UNBOUNDED PRECEDING)::bigint AS running_quantity
        FROM reservation_events
      ),
      reservation_pressure AS (
        SELECT
          variant_size_id,
          MAX(running_quantity)::bigint AS peak_reserved_quantity,
          MIN(event_date) FILTER (WHERE event_date > CURRENT_DATE AND delta > 0) AS next_reserved_start
        FROM reservation_pressure_points
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
          rp.next_reserved_start,
          COALESCE(rp.peak_reserved_quantity, 0)::bigint AS peak_reserved_quantity,
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
        LEFT JOIN reservation_pressure rp ON rp.variant_size_id = vs.id
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
        next_reserved_start AS "nextReservedStart",
        peak_reserved_quantity AS "peakReservedQuantity",
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
        peakReservedQuantity: Number(row.peakReservedQuantity),
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
    const today = this.today();
    if (Boolean(query.availableFrom) !== Boolean(query.availableTo)) {
      throw new BadRequestException('Both availableFrom and availableTo are required');
    }
    const availableFrom = query.availableFrom ? this.date(query.availableFrom) : null;
    const availableTo = query.availableTo ? this.date(query.availableTo) : null;
    if (availableFrom && availableTo && availableFrom > availableTo) {
      throw new BadRequestException('availableFrom must be on or before availableTo');
    }
    if (availableFrom && !query.productId && !query.variantSizeId) {
      throw new BadRequestException('Choose a product or SKU before filtering by rental dates');
    }
    const attentionWhere: Prisma.StockUnitWhereInput | null = query.attention === 'OPEN_ISSUE'
      ? { issues: { some: { status: { in: ['OPEN', 'IN_SERVICE'] } } } }
      : query.attention === 'OPEN_SERVICE'
        ? { serviceOrders: { some: { status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } } } }
        : query.attention === 'INCOMPLETE_SET'
          ? { componentStates: { some: { setComponentDefinition: { isActive: true, absenceBlocksRental: true }, presence: { in: ['MISSING', 'DAMAGED'] } } } }
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
      AND: attentionWhere ? [attentionWhere] : [],
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
    let availabilityIds: string[] | null = null;
    if (availableFrom && availableTo) {
      if (!this.availability) throw new BadRequestException('Availability filtering is not configured');
      const candidates = await this.prisma.stockUnit.findMany({
        where,
        take: 501,
        select: {
          id: true,
          locationId: true,
          variantSizeId: true,
          variantSize: { select: { variant: { select: { productId: true } } } },
        },
      });
      if (candidates.length > 500) {
        throw new BadRequestException('Narrow the date filter to a SKU; this product has more than 500 physical items');
      }
      availabilityIds = [];
      for (let offset = 0; offset < candidates.length; offset += 20) {
        const results = await Promise.all(candidates.slice(offset, offset + 20).map(async (unit) => ({
          id: unit.id,
          result: await this.availability!.check({
            tenantId,
            productId: unit.variantSize.variant.productId,
            variantSizeId: unit.variantSizeId,
            preferredStockUnitId: unit.id,
            sourceLocationId: unit.locationId,
            startDate: availableFrom,
            endDate: availableTo,
            quantity: 1,
            enforcePublished: false,
            allowPreferredOutsideStorefrontMode: true,
            requireStorefrontVisibility: false,
          }),
        })));
        availabilityIds.push(...results.filter(({ result }) => result.available).map(({ id }) => id));
      }
    }
    const finalWhere: Prisma.StockUnitWhereInput = availabilityIds
      ? { AND: [where, { id: { in: availabilityIds } }] }
      : where;
    const [data, total] = await Promise.all([
      this.prisma.stockUnit.findMany({
        where: finalWhere,
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
      this.prisma.stockUnit.count({ where: finalWhere }),
    ]);
    const [metrics, lastAssignments, nextAssignments] = data.length
      ? await Promise.all([this.prisma.$queryRaw<
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
        `),
        this.prisma.stockUnitAssignment.findMany({
          where: { tenantId, stockUnitId: { in: data.map((item) => item.id) }, reservation: { booking: { status: 'completed' } } },
          distinct: ['stockUnitId'],
          orderBy: [{ stockUnitId: 'asc' }, { blockedEndDate: 'desc' }],
          select: { stockUnitId: true, blockedEndDate: true, reservation: { select: { booking: { select: { id: true, bookingNumber: true } } } } },
        }),
        this.prisma.stockUnitAssignment.findMany({
          where: { tenantId, stockUnitId: { in: data.map((item) => item.id) }, releasedAt: null, blockedEndDate: { gte: today }, reservation: { status: { in: ['PENDING', 'CONFIRMED'] } } },
          distinct: ['stockUnitId'],
          orderBy: [{ stockUnitId: 'asc' }, { blockedStartDate: 'asc' }],
          select: { stockUnitId: true, blockedStartDate: true, blockedEndDate: true, reservation: { select: { booking: { select: { id: true, bookingNumber: true } } } } },
        }),
      ])
      : [[], [], []] as const;
    const metricsByUnit = new Map(
      metrics.map((item) => [
        item.stock_unit_id,
        {
          completedRentals: Number(item.completed_rentals),
          totalRentalDays: Number(item.total_rental_days),
        },
      ]),
    );
    const lastByUnit = new Map(lastAssignments.map((assignment) => [assignment.stockUnitId, assignment]));
    const nextByUnit = new Map(nextAssignments.map((assignment) => [assignment.stockUnitId, assignment]));
    return {
      data: data.map((item) => ({
        ...item,
        rentalMetrics: metricsByUnit.get(item.id) ?? {
          completedRentals: 0,
          totalRentalDays: 0,
        },
        componentComplete: item.componentStates.length === 0,
        lastRental: lastByUnit.get(item.id) ?? null,
        nextRental: nextByUnit.get(item.id) ?? null,
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
