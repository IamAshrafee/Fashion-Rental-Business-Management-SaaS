import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService period alignment', () => {
  it('derives category booked value from qualifying booking lines in the requested period', async () => {
    const prisma = {
      bookingItem: {
        findMany: jest.fn().mockResolvedValue([
          { baseRental: 10_000, extendedCost: 1_000, product: { category: { name: 'Sarees' } } },
          { baseRental: 5_000, extendedCost: 0, product: { category: { name: 'Sarees' } } },
          { baseRental: 4_000, extendedCost: 0, product: { category: { name: 'Lehengas' } } },
        ]),
      },
    };
    const service = new AnalyticsService(prisma as never);

    const result = await service.getRevenueByCategory('tenant-1', {
      from: '2026-08-01',
      to: '2026-08-07',
    });

    expect(prisma.bookingItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        booking: expect.objectContaining({ status: { notIn: ['cancelled', 'pending'] } }),
      }),
    }));
    expect(result).toEqual([
      { category: 'Sarees', revenue: 16_000, percentage: 80 },
      { category: 'Lehengas', revenue: 4_000, percentage: 20 },
    ]);
  });

  it('ranks top products using distinct bookings and booked value from the same period', async () => {
    const product = (name: string) => ({ name, variants: [] });
    const prisma = {
      bookingItem: {
        findMany: jest.fn().mockResolvedValue([
          { bookingId: 'b-1', productId: 'p-1', productName: 'Saree', baseRental: 5_000, extendedCost: 0, product: product('Saree') },
          { bookingId: 'b-1', productId: 'p-1', productName: 'Saree', baseRental: 2_000, extendedCost: 0, product: product('Saree') },
          { bookingId: 'b-2', productId: 'p-1', productName: 'Saree', baseRental: 4_000, extendedCost: 0, product: product('Saree') },
          { bookingId: 'b-3', productId: 'p-2', productName: 'Lehenga', baseRental: 20_000, extendedCost: 0, product: product('Lehenga') },
        ]),
      },
      stockUnit: { count: jest.fn().mockResolvedValue(1) },
      inventoryReservation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AnalyticsService(prisma as never);

    const byBookings = await service.getTopProducts('tenant-1', {
      sortBy: 'bookings',
      limit: 2,
      from: '2026-08-01',
      to: '2026-08-07',
    });
    const byRevenue = await service.getTopProducts('tenant-1', {
      sortBy: 'revenue',
      limit: 2,
      from: '2026-08-01',
      to: '2026-08-07',
    });

    expect(byBookings[0]).toEqual(expect.objectContaining({
      productId: 'p-1',
      totalBookings: 2,
      totalRevenue: 11_000,
    }));
    expect(byRevenue[0]).toEqual(expect.objectContaining({
      productId: 'p-2',
      totalBookings: 1,
      totalRevenue: 20_000,
    }));
  });

  it('rejects reversed date ranges', async () => {
    const service = new AnalyticsService({} as never);
    await expect(service.getRevenueByCategory('tenant-1', {
      from: '2026-08-10',
      to: '2026-08-01',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
