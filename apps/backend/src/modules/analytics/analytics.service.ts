import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryDto, RevenueChartQueryDto, TopProductsQueryDto } from './dto/analytics.dto';
import {
  AnalyticsSummary,
  RevenueSeries,
  RevenueSeriesPoint,
  CategoryRevenue,
  TopProduct,
  TargetRecoverySummary,
  TargetRecoveryProduct,
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
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
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
      select: { grandTotal: true, totalDeposit: true },
    });

    // Calculate Revenues (excluding deposits)
    const calculateRevenue = (bookings: any[]) =>
      bookings
        .filter((b) => !['cancelled', 'pending'].includes(b.status)) // basic heuristic
        .reduce((sum, b) => sum + (b.grandTotal - b.totalDeposit), 0);

    const totalRevenue = calculateRevenue(currentBookings);
    const previousRevenue = calculateRevenue(previousBookings);
    const growthPercentage = this.calculateGrowth(totalRevenue, previousRevenue);

    // Filter valid vs completed vs active...
    const completedStatuses = ['completed', 'returned', 'inspected'];
    const activeStatuses = ['confirmed', 'shipped', 'delivered', 'overdue'];

    const totalBookingsCount = currentBookings.length;
    const completedCount = currentBookings.filter((b) => completedStatuses.includes(b.status)).length;
    const activeCount = currentBookings.filter((b) => activeStatuses.includes(b.status)).length;
    const cancelledCount = currentBookings.filter((b) => b.status === 'cancelled').length;
    const cancellationRate = totalBookingsCount === 0 ? 0 : Number(((cancelledCount / totalBookingsCount) * 100).toFixed(1));
    const averageOrderValue = completedCount === 0 ? 0 : Math.round(totalRevenue / completedCount);

    // Customers
    // For this simple stat, new means createdAt in range, returning means totalBookings > 1
    const customersInRange = await this.prisma.customer.findMany({
      where: { tenantId, deletedAt: null, /* ideally filter by booking in date range, but we cheat here */ },
      select: { createdAt: true, totalBookings: true },
    });
    
    // Better way to do active customers in range:
    const activeCustomerIds = await this.prisma.booking.groupBy({
      by: ['customerId'],
      where: { tenantId, createdAt: { gte: from, lte: to }, deletedAt: null },
    });

    const totalCustomersThisPeriod = activeCustomerIds.length;
    let newCustomers = 0;
    
    // We can count how many of these active customers were created in this period
    const allStoreCustomers = await this.prisma.customer.findMany({
        where: { tenantId, deletedAt: null }
    });
    const newCount = allStoreCustomers.filter(c => c.createdAt >= from && c.createdAt <= to).length;
    const returningUsersCount = allStoreCustomers.filter(c => c.totalBookings > 1).length;
    const totalStoreCustomers = allStoreCustomers.length;
    const retentionRate = totalStoreCustomers === 0 ? 0 : Number(((returningUsersCount / totalStoreCustomers) * 100).toFixed(1));

    // Products
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, status: true, totalBookings: true },
    });

    const totalActiveProducts = products.filter((p) => p.status === 'published').length;
    const idleProducts = products.filter((p) => p.totalBookings === 0 && p.status === 'published').length;
    const averageUtilization = 0; // Requires complex date blocking calculations, stub for v1

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

    return products.map((p) => {
      let thumb = null;
      if (p.variants.length > 0 && p.variants[0].images.length > 0) {
        thumb = p.variants[0].images[0].thumbnailUrl;
      }

      return {
        productId: p.id,
        name: p.name,
        totalBookings: p.totalBookings,
        totalRevenue: p.totalRevenue,
        utilizationRate: 0, // stub
        thumbnailUrl: thumb,
      };
    });
  }

  async getTargetRecovery(tenantId: string): Promise<TargetRecoverySummary> {
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null, purchasePrice: { not: null } },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        totalRevenue: true,
      },
    });

    let totalInvestment = 0;
    let totalRecovered = 0;
    let productsAtTarget = 0;
    let productsBelowTarget = 0;

    const items: TargetRecoveryProduct[] = products.map((p) => {
      const purchasePrice = p.purchasePrice || 0;
      const recovered = p.totalRevenue;
      const perc = purchasePrice > 0 ? (recovered / purchasePrice) * 100 : 100;
      
      totalInvestment += purchasePrice;
      totalRecovered += recovered;

      let status: 'exceeded' | 'recovering' | 'idle' = 'idle';
      if (recovered === 0) status = 'idle';
      else if (recovered >= purchasePrice) status = 'exceeded';
      else status = 'recovering';

      if (status === 'exceeded') productsAtTarget++;
      if (status === 'recovering' || status === 'idle') productsBelowTarget++;

      return {
        productId: p.id,
        name: p.name,
        purchasePrice,
        recovered,
        recoveryPercentage: Number(perc.toFixed(1)),
        status,
      };
    });

    items.sort((a, b) => b.recoveryPercentage - a.recoveryPercentage);

    const overallRecoveryPercentage = totalInvestment > 0 ? Number(((totalRecovered / totalInvestment) * 100).toFixed(1)) : 0;

    return {
      totalInvestment,
      totalRecovered,
      overallRecoveryPercentage,
      productsAtTarget,
      productsBelowTarget,
      products: items,
    };
  }
}
