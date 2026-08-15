import { InventoryDashboardService } from '../inventory-dashboard.service';

describe('InventoryDashboardService', () => {
  it('includes zero-defaulted rental metrics for every listed physical item', async () => {
    const prisma = {
      stockUnit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'unit-1',
            componentStates: [],
            location: { id: 'location-1', code: 'MAIN', name: 'Main' },
            variantSize: {
              id: 'sku-1',
              sizeInstance: { displayLabel: 'M' },
              variant: {
                id: 'variant-1',
                variantName: null,
                product: { id: 'product-1', name: 'Dress' },
              },
            },
            _count: { inspections: 0, issues: 0, serviceOrders: 0 },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const service = new InventoryDashboardService(prisma as never);

    const result = await service.listItems('tenant-1', { page: 1, limit: 25 } as never);

    expect(result.data[0]).toMatchObject({
      componentComplete: true,
      rentalMetrics: { completedRentals: 0, totalRentalDays: 0 },
      lastRental: null,
      nextRental: null,
    });
  });
});
