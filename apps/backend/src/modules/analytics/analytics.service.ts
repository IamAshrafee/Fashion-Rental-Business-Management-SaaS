import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalyticsExportType,
  AnalyticsQueryDto,
  RevenueChartQueryDto,
  TopProductsQueryDto,
} from './dto/analytics.dto';
import {
  AnalyticsSummary,
  RevenueSeries,
  RevenueSeriesPoint,
  CategoryRevenue,
  TopProduct,
  CostRecoverySummary,
  CostRecoveryProduct,
  StorefrontTrafficSummary,
  TrafficFunnel,
  TopViewedProduct,
  AttributionSource,
} from '@closetrent/types';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse dates, returning a robust fallback.
   * Default: 30 days ago to now.
   */
  private getDateRange(query: AnalyticsQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    // If 'to' was provided as exactly YYYY-MM-DD, push it to the end of that day to include all today's events
    if (query.to && query.to.length <= 10) {
      to.setUTCHours(23, 59, 59, 999);
    }

    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    // Best practice to align 'from' to start of day if it was provided as a string
    if (query.from && query.from.length <= 10) {
      from.setUTCHours(0, 0, 0, 0);
    }

    return { from, to };
  }

  /**
   * Helper to fetch the start of a previous period to calculate growth percentage.
   */
  private getPreviousDateRange(from: Date, to: Date): { prevFrom: Date; prevTo: Date } {
    const msDiff = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - msDiff);
    return { prevFrom, prevTo };
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private async calculateUtilization(
    tenantId: string,
    from: Date,
    to: Date,
    productId?: string,
  ): Promise<number> {
    const productFilter = productId ? { variantSize: { variant: { productId } } } : {};
    const [physicalItemCapacity, reservations] = await Promise.all([
      this.prisma.stockUnit.count({
        where: { tenantId, deletedAt: null, disposition: 'ACTIVE', ...productFilter },
      }),
      this.prisma.inventoryReservation.findMany({
        where: {
          tenantId,
          ...(productId ? { productId } : {}),
          status: { notIn: ['CANCELLED', 'EXPIRED'] },
          blockedStartDate: { lte: to },
          blockedEndDate: { gte: from },
        },
        select: { blockedStartDate: true, blockedEndDate: true, quantity: true },
      }),
    ]);
    const capacity = physicalItemCapacity;
    if (!capacity) return 0;
    const dayMs = 86_400_000;
    const periodDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / dayMs) + 1);
    const occupiedUnitDays = reservations.reduce((sum, reservation) => {
      const start = new Date(Math.max(from.getTime(), reservation.blockedStartDate.getTime()));
      const end = new Date(Math.min(to.getTime(), reservation.blockedEndDate.getTime()));
      const overlapDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / dayMs) + 1);
      return sum + overlapDays * reservation.quantity;
    }, 0);
    return Number((Math.min(1, occupiedUnitDays / (capacity * periodDays)) * 100).toFixed(1));
  }

  async exportCsv(tenantId: string, type: AnalyticsExportType, query: AnalyticsQueryDto) {
    const { from, to } = this.getDateRange(query);
    let rows: Array<Record<string, unknown>>;

    if (type === 'bookings') {
      const records = await this.prisma.booking.findMany({
        where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: {
          bookingNumber: true,
          channel: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          rentalStartDate: true,
          rentalEndDate: true,
          deliveryName: true,
          deliveryPhone: true,
          subtotal: true,
          totalFees: true,
          shippingFee: true,
          totalDeposit: true,
          discountAmount: true,
          grandTotal: true,
          totalPaid: true,
          createdAt: true,
        },
      });
      rows = records.map((record) => ({
        booking_number: record.bookingNumber,
        channel: record.channel,
        status: record.status,
        payment_status: record.paymentStatus,
        payment_method: record.paymentMethod,
        customer: record.deliveryName,
        phone: record.deliveryPhone,
        rental_start: record.rentalStartDate,
        rental_end: record.rentalEndDate,
        subtotal: record.subtotal,
        fees: record.totalFees,
        shipping: record.shippingFee,
        deposit: record.totalDeposit,
        discount: record.discountAmount,
        grand_total: record.grandTotal,
        paid: record.totalPaid,
        balance_due: Math.max(0, record.grandTotal - record.totalPaid),
        created_at: record.createdAt,
      }));
    } else if (type === 'customers') {
      const records = await this.prisma.customer.findMany({
        where: { tenantId, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: {
          fullName: true,
          status: true,
          preferredContactChannel: true,
          source: true,
          totalBookings: true,
          totalSpent: true,
          lastBookingAt: true,
          createdAt: true,
          identities: { where: { isPrimary: true }, select: { kind: true, value: true } },
        },
      });
      rows = records.map((record) => ({
        customer: record.fullName,
        status: record.status,
        primary_identity: record.identities[0]?.kind ?? '',
        contact: record.identities[0]?.value ?? '',
        preferred_channel: record.preferredContactChannel,
        source: record.source ?? '',
        total_bookings: record.totalBookings,
        total_spent: record.totalSpent,
        last_booking_at: record.lastBookingAt,
        created_at: record.createdAt,
      }));
    } else if (type === 'inventory') {
      const records = await this.prisma.stockUnit.findMany({
        where: { tenantId, deletedAt: null, createdAt: { lte: to } },
        orderBy: { assetCode: 'asc' },
        take: 10_000,
        select: {
          assetCode: true,
          barcode: true,
          disposition: true,
          operationalState: true,
          condition: true,
          storefrontVisible: true,
          acquisitionDate: true,
          acquisitionCost: true,
          acquisitionSource: true,
          acquisitionReference: true,
          estimatedCurrentValue: true,
          createdAt: true,
          location: { select: { code: true, name: true } },
          variantSize: {
            select: {
              sizeInstance: { select: { displayLabel: true } },
              variant: { select: { variantName: true, product: { select: { name: true } } } },
            },
          },
        },
      });
      rows = records.map((record) => ({
        asset_code: record.assetCode,
        barcode: record.barcode ?? '',
        product: record.variantSize.variant.product.name,
        variant: record.variantSize.variant.variantName ?? '',
        size: record.variantSize.sizeInstance.displayLabel,
        location_code: record.location.code,
        location: record.location.name,
        disposition: record.disposition,
        operational_state: record.operationalState,
        condition: record.condition,
        storefront_visible: record.storefrontVisible,
        acquisition_date: record.acquisitionDate,
        acquisition_cost: record.acquisitionCost,
        acquisition_source: record.acquisitionSource ?? '',
        acquisition_reference: record.acquisitionReference ?? '',
        estimated_value: record.estimatedCurrentValue,
        registered_at: record.createdAt,
      }));
    } else if (type === 'payments') {
      const records = await this.prisma.payment.findMany({
        where: { tenantId, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: {
          amount: true,
          rentalAmount: true,
          depositAmount: true,
          method: true,
          status: true,
          transactionId: true,
          verifiedAt: true,
          refundAmount: true,
          refundedAt: true,
          notes: true,
          createdAt: true,
          booking: { select: { bookingNumber: true, deliveryName: true, deliveryPhone: true } },
          recorder: { select: { fullName: true } },
        },
      });
      rows = records.map((record) => ({
        booking_number: record.booking.bookingNumber,
        customer: record.booking.deliveryName,
        phone: record.booking.deliveryPhone,
        amount: record.amount,
        rental_amount: record.rentalAmount,
        deposit_amount: record.depositAmount,
        method: record.method,
        status: record.status,
        transaction_id: record.transactionId ?? '',
        verified_at: record.verifiedAt,
        refund_amount: record.refundAmount ?? 0,
        refunded_at: record.refundedAt,
        recorded_by: record.recorder?.fullName ?? 'System',
        notes: record.notes ?? '',
        created_at: record.createdAt,
      }));
    } else {
      const recovery = await this.getCostRecovery(tenantId);
      rows = recovery.products.map((record) => ({
        product: record.name,
        acquisition_cost: record.acquisitionCost,
        attributed_rental_revenue: record.attributedRentalRevenue,
        recorded_service_cost: record.recordedServiceCost,
        net_contribution: record.netContribution,
        recovery_percentage: record.recoveryPercentage,
        status: record.status,
      }));
    }

    const date = new Date().toISOString().slice(0, 10);
    return { filename: `${type}-${date}.csv`, csv: this.toCsv(rows) };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    if (!rows.length) return 'no_records\n';
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => {
      let normalized =
        value instanceof Date ? value.toISOString() : value == null ? '' : String(value);
      if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
      return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
    };
    return [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
    ].join('\r\n');
  }

  async getSummary(tenantId: string, query: AnalyticsQueryDto): Promise<AnalyticsSummary> {
    const { from, to } = this.getDateRange(query);
    const { prevFrom, prevTo } = this.getPreviousDateRange(from, to);

    // Fetch Bookings for current period
    const currentBookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
        deletedAt: null,
      },
      select: { grandTotal: true, totalDeposit: true, status: true },
    });

    // Fetch Bookings for previous period (for revenue growth)
    const previousBookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: prevFrom, lte: prevTo },
        deletedAt: null,
      },
      select: { grandTotal: true, totalDeposit: true, status: true },
    });

    // Calculate Revenues (excluding deposits)
    const calculateRevenue = (
      bookings: { grandTotal: number; totalDeposit: number; status: string }[],
    ) =>
      bookings
        .filter((b) => !['cancelled', 'pending'].includes(b.status)) // basic heuristic
        .reduce((sum, b) => sum + (b.grandTotal - b.totalDeposit), 0);

    const totalRevenue = calculateRevenue(currentBookings);
    const previousRevenue = calculateRevenue(previousBookings);
    const growthPercentage = this.calculateGrowth(totalRevenue, previousRevenue);

    // Filter valid vs completed vs active...
    const completedStatuses = ['completed', 'returned', 'inspected'];
    const activeStatuses = ['confirmed', 'delivered', 'overdue'];

    const totalBookingsCount = currentBookings.length;
    const completedCount = currentBookings.filter((b) =>
      completedStatuses.includes(b.status),
    ).length;
    const activeCount = currentBookings.filter((b) => activeStatuses.includes(b.status)).length;
    const cancelledCount = currentBookings.filter((b) => b.status === 'cancelled').length;
    const cancellationRate =
      totalBookingsCount === 0
        ? 0
        : Number(((cancelledCount / totalBookingsCount) * 100).toFixed(1));
    const averageOrderValue = completedCount === 0 ? 0 : Math.round(totalRevenue / completedCount);

    // Better way to do active customers in range:
    // We can count how many of these active customers were created in this period
    const allStoreCustomers = await this.prisma.customer.findMany({
      where: { tenantId, status: { notIn: ['merged', 'anonymized', 'archived'] } },
    });
    const newCount = allStoreCustomers.filter(
      (c) => c.createdAt >= from && c.createdAt <= to,
    ).length;
    const returningUsersCount = allStoreCustomers.filter((c) => c.totalBookings > 1).length;
    const totalStoreCustomers = allStoreCustomers.length;
    const retentionRate =
      totalStoreCustomers === 0
        ? 0
        : Number(((returningUsersCount / totalStoreCustomers) * 100).toFixed(1));

    // Products
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, status: true, totalBookings: true },
    });

    const totalActiveProducts = products.filter((p) => p.status === 'published').length;
    const idleProducts = products.filter(
      (p) => p.totalBookings === 0 && p.status === 'published',
    ).length;
    const averageUtilization = await this.calculateUtilization(tenantId, from, to);

    return {
      revenue: {
        total: totalRevenue,
        previousPeriod: previousRevenue,
        growthPercentage,
        averageOrderValue,
      },
      bookings: {
        total: totalBookingsCount,
        completed: completedCount,
        active: activeCount,
        cancelled: cancelledCount,
        cancellationRate,
      },
      customers: {
        total: totalStoreCustomers,
        new: newCount,
        returning: returningUsersCount,
        retentionRate,
      },
      products: {
        totalActive: totalActiveProducts,
        idle: idleProducts,
        averageUtilization,
      },
    };
  }

  async getRevenueSeries(tenantId: string, query: RevenueChartQueryDto): Promise<RevenueSeries> {
    const { from, to } = this.getDateRange(query);
    const groupBy = query.groupBy || 'day'; // 'day', 'week', 'month'

    // Fetch valid bookings in range
    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
        status: { notIn: ['cancelled', 'pending'] },
        deletedAt: null,
      },
      select: { createdAt: true, grandTotal: true, totalDeposit: true },
    });

    // Grouping logic entirely in memory for v1 (to avoid raw SQL dialect issues)
    const seriesMap = new Map<string, number>();

    for (const b of bookings) {
      const rev = b.grandTotal - b.totalDeposit;
      let dateKey = '';

      const d = b.createdAt;
      if (groupBy === 'day') {
        dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (groupBy === 'month') {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // week fallback to day for simplicity here
        dateKey = d.toISOString().split('T')[0];
      }

      seriesMap.set(dateKey, (seriesMap.get(dateKey) || 0) + rev);
    }

    // Sort series
    const sortedKeys = Array.from(seriesMap.keys()).sort();
    const series: RevenueSeriesPoint[] = sortedKeys.map((k) => ({
      date: k,
      revenue: seriesMap.get(k) || 0,
    }));

    const total = series.reduce((sum, p) => sum + p.revenue, 0);

    return { series, total };
  }

  async getRevenueByCategory(tenantId: string): Promise<CategoryRevenue[]> {
    // In v1, we can compute this using Product.totalRevenue and Product.categoryId
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: { totalRevenue: true, category: { select: { name: true } } },
    });

    let totalAll = 0;
    const catMap = new Map<string, number>();

    for (const p of products) {
      const catName = p.category.name;
      const rev = p.totalRevenue;
      if (rev > 0) {
        catMap.set(catName, (catMap.get(catName) || 0) + rev);
        totalAll += rev;
      }
    }

    const result: CategoryRevenue[] = Array.from(catMap.entries()).map(([cat, rev]) => ({
      category: cat,
      revenue: rev,
      percentage: totalAll > 0 ? Number(((rev / totalAll) * 100).toFixed(1)) : 0,
    }));

    result.sort((a, b) => b.revenue - a.revenue);
    return result;
  }

  async getTopProducts(tenantId: string, query: TopProductsQueryDto): Promise<TopProduct[]> {
    const sortBy = query.sortBy || 'bookings';
    const limit = query.limit || 10;

    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: sortBy === 'bookings' ? { totalBookings: 'desc' } : { totalRevenue: 'desc' },
      take: limit,
      include: {
        variants: {
          include: { images: { where: { isFeatured: true }, take: 1 } },
          take: 1,
        },
      },
    });

    const utilizationFrom = new Date(Date.now() - 30 * 86_400_000);
    const utilizationTo = new Date();
    return Promise.all(
      products.map(async (p) => {
        let thumb = null;
        if (p.variants.length > 0 && p.variants[0].images.length > 0) {
          thumb = p.variants[0].images[0].thumbnailUrl;
        }

        return {
          productId: p.id,
          name: p.name,
          totalBookings: p.totalBookings,
          totalRevenue: p.totalRevenue,
          utilizationRate: await this.calculateUtilization(
            tenantId,
            utilizationFrom,
            utilizationTo,
            p.id,
          ),
          thumbnailUrl: thumb,
        };
      }),
    );
  }

  async getCostRecovery(tenantId: string): Promise<CostRecoverySummary> {
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        variants: {
          select: {
            sizes: {
              select: {
                stockUnits: {
                  where: { deletedAt: null },
                  select: {
                    acquisitionCost: true,
                    revenueAllocations: { select: { amount: true } },
                    serviceOrders: {
                      where: { status: 'COMPLETED' },
                      select: { cost: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let totalAcquisitionCost = 0;
    let totalAttributedRevenue = 0;
    let totalRecordedServiceCost = 0;
    let recoveredProducts = 0;
    let recoveringProducts = 0;
    let incompleteProducts = 0;

    const items: CostRecoveryProduct[] = products.map((p) => {
      const units = p.variants.flatMap((variant) =>
        variant.sizes.flatMap((size) => size.stockUnits),
      );
      const missingAcquisitionCostCount = units.filter(
        (unit) => unit.acquisitionCost === null,
      ).length;
      const acquisitionCost = units.reduce((sum, unit) => sum + (unit.acquisitionCost ?? 0), 0);
      const attributedRentalRevenue = units.reduce(
        (sum, unit) =>
          sum +
          unit.revenueAllocations.reduce((subtotal, allocation) => subtotal + allocation.amount, 0),
        0,
      );
      const recordedServiceCost = units.reduce(
        (sum, unit) =>
          sum + unit.serviceOrders.reduce((subtotal, order) => subtotal + (order.cost ?? 0), 0),
        0,
      );
      const netContribution = attributedRentalRevenue - recordedServiceCost;
      const inputsComplete =
        units.length > 0 && missingAcquisitionCostCount === 0 && acquisitionCost > 0;
      const recoveryPercentage = inputsComplete
        ? Number(((netContribution / acquisitionCost) * 100).toFixed(1))
        : null;
      const status: CostRecoveryProduct['status'] = !inputsComplete
        ? 'incomplete'
        : netContribution >= acquisitionCost
          ? 'recovered'
          : attributedRentalRevenue > 0
            ? 'recovering'
            : 'idle';

      totalAcquisitionCost += acquisitionCost;
      totalAttributedRevenue += attributedRentalRevenue;
      totalRecordedServiceCost += recordedServiceCost;
      if (status === 'recovered') recoveredProducts += 1;
      if (status === 'recovering' || status === 'idle') recoveringProducts += 1;
      if (status === 'incomplete') incompleteProducts += 1;

      return {
        productId: p.id,
        name: p.name,
        physicalItemCount: units.length,
        acquisitionCost,
        attributedRentalRevenue,
        recordedServiceCost,
        netContribution,
        missingAcquisitionCostCount,
        recoveryPercentage,
        status,
      };
    });

    items.sort((a, b) => (b.recoveryPercentage ?? -1) - (a.recoveryPercentage ?? -1));

    const netContribution = totalAttributedRevenue - totalRecordedServiceCost;
    const overallRecoveryPercentage =
      totalAcquisitionCost > 0
        ? Number(((netContribution / totalAcquisitionCost) * 100).toFixed(1))
        : null;

    return {
      totalAcquisitionCost,
      totalAttributedRevenue,
      totalRecordedServiceCost,
      netContribution,
      overallRecoveryPercentage,
      recoveredProducts,
      recoveringProducts,
      incompleteProducts,
      products: items,
    };
  }

  // ---------------------------------------------------------
  // Storefront Traffic Funnel Analytics
  // ---------------------------------------------------------

  async getStorefrontSummary(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<StorefrontTrafficSummary> {
    const { from, to } = this.getDateRange(query);
    const { prevFrom, prevTo } = this.getPreviousDateRange(from, to);

    const [currentEvents, previousEvents] = await Promise.all([
      this.prisma.storefrontEvent.findMany({
        where: { tenantId, productId: query.productId, createdAt: { gte: from, lte: to } },
        select: { sessionId: true, eventType: true },
      }),
      this.prisma.storefrontEvent.findMany({
        where: { tenantId, productId: query.productId, createdAt: { gte: prevFrom, lte: prevTo } },
        select: { sessionId: true },
      }),
    ]);

    const uniqueVisitors = new Set(currentEvents.map((e) => e.sessionId)).size;
    const previousVisitors = new Set(previousEvents.map((e) => e.sessionId)).size;
    const totalViews = currentEvents.filter((e) => e.eventType === 'product_view').length;
    const cartAdds = currentEvents.filter((e) => e.eventType === 'add_to_cart').length;

    const cartConversionRate =
      uniqueVisitors > 0 ? Number(((cartAdds / uniqueVisitors) * 100).toFixed(1)) : 0;
    const growthPercentage = this.calculateGrowth(uniqueVisitors, previousVisitors);

    return {
      uniqueVisitors,
      totalViews,
      cartAdds,
      cartConversionRate,
      previousVisitors,
      growthPercentage,
    };
  }

  async getFunnelMetrics(tenantId: string, query: AnalyticsQueryDto): Promise<TrafficFunnel> {
    const { from, to } = this.getDateRange(query);
    const events = await this.prisma.storefrontEvent.findMany({
      where: {
        tenantId,
        productId: query.productId,
        createdAt: { gte: from, lte: to },
        eventType: { in: ['product_view', 'add_to_cart', 'checkout_started'] },
      },
      select: { eventType: true },
    });

    const views = events.filter((e) => e.eventType === 'product_view').length;
    const carts = events.filter((e) => e.eventType === 'add_to_cart').length;
    const checkouts = events.filter((e) => e.eventType === 'checkout_started').length;

    return {
      nodes: [
        { step: 'Product Views', count: views, dropOffRate: 0 },
        {
          step: 'Added to Cart',
          count: carts,
          dropOffRate: views > 0 ? Number(((1 - carts / views) * 100).toFixed(1)) : 0,
        },
        {
          step: 'Checkout Started',
          count: checkouts,
          dropOffRate: carts > 0 ? Number(((1 - checkouts / carts) * 100).toFixed(1)) : 0,
        },
      ],
    };
  }

  async getTopViewedProducts(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<TopViewedProduct[]> {
    const { from, to } = this.getDateRange(query);

    const events = await this.prisma.storefrontEvent.findMany({
      where: { tenantId, productId: { not: null }, createdAt: { gte: from, lte: to } },
      select: { productId: true, eventType: true },
    });

    const productStats = new Map<string, { views: number; carts: number; checkouts: number }>();

    for (const e of events) {
      if (!e.productId) continue;
      if (!productStats.has(e.productId))
        productStats.set(e.productId, { views: 0, carts: 0, checkouts: 0 });
      const stats = productStats.get(e.productId)!;
      if (e.eventType === 'product_view') stats.views++;
      else if (e.eventType === 'add_to_cart') stats.carts++;
      else if (e.eventType === 'checkout_started') stats.checkouts++;
    }

    const topIds = Array.from(productStats.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 15)
      .map((entry) => entry[0]);

    if (topIds.length === 0) return [];

    const productsInfo = await this.prisma.product.findMany({
      where: { id: { in: topIds } },
      select: {
        id: true,
        name: true,
        variants: { include: { images: { where: { isFeatured: true }, take: 1 } }, take: 1 },
      },
    });

    return topIds.map((id) => {
      const p = productsInfo.find((x) => x.id === id);
      const stats = productStats.get(id)!;
      let thumb = null;
      if (p?.variants?.[0]?.images?.[0]) thumb = p.variants[0].images[0].thumbnailUrl;

      return {
        productId: id,
        name: p?.name || 'Unknown',
        views: stats.views,
        cartAdds: stats.carts,
        checkoutStarts: stats.checkouts,
        viewToCartRate:
          stats.views > 0 ? Number(((stats.carts / stats.views) * 100).toFixed(1)) : 0,
        cartToCheckoutRate:
          stats.carts > 0 ? Number(((stats.checkouts / stats.carts) * 100).toFixed(1)) : 0,
        thumbnailUrl: thumb,
      };
    });
  }

  async getMarketingAttribution(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<AttributionSource[]> {
    const { from, to } = this.getDateRange(query);
    const events = await this.prisma.storefrontEvent.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: { metadata: true, eventType: true },
    });

    const attrMap = new Map<string, { views: number; carts: number; checkouts: number }>();

    for (const e of events) {
      const meta = e.metadata as any;
      // We need to parse metadata safely if it's stored as plain stringified JSON, but Prisma handles JSONB object directly.
      const source = meta?.utm_source || 'Direct / Organic';
      const campaign = meta?.utm_campaign || 'N/A';
      const key = `${source}|${campaign}`;

      if (!attrMap.has(key)) attrMap.set(key, { views: 0, carts: 0, checkouts: 0 });
      const stats = attrMap.get(key)!;

      if (e.eventType === 'product_view') stats.views++;
      else if (e.eventType === 'add_to_cart') stats.carts++;
      else if (e.eventType === 'checkout_started') stats.checkouts++;
    }

    return Array.from(attrMap.entries())
      .map(([key, stats]) => {
        const [source, campaign] = key.split('|');
        return {
          source,
          campaign,
          views: stats.views,
          cartAdds: stats.carts,
          checkouts: stats.checkouts,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 50); // limit to top 50 sources to prevent huge payloads
  }
}
