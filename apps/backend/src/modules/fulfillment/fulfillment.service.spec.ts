import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentService } from './fulfillment.service';

describe('FulfillmentService delivery dashboard', () => {
  const shipment = {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const service = new FulfillmentService(
    { shipment } as unknown as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns preserved summaries and a stage for each projected delivery', async () => {
    const occurredAt = new Date('2026-08-15T08:00:00.000Z');
    shipment.groupBy.mockResolvedValue([
      { status: 'prepare_parcel', _count: 2 },
      { status: 'in_transit', _count: 1 },
    ]);
    shipment.findMany.mockResolvedValue([
      {
        id: 'shipment-1',
        direction: 'OUTBOUND',
        provider: 'manual',
        providerReference: null,
        status: 'in_transit',
        failedReason: null,
        trackingNumber: 'TRACK-1',
        pickupRequestedAt: occurredAt,
        scheduledPickupAt: occurredAt,
        deliveredAt: null,
        events: [
          { status: 'in_transit', label: 'In transit', occurredAt, source: 'manual' },
        ],
        booking: {
          id: 'booking-1',
          bookingNumber: 'BK-001',
          status: 'confirmed',
          deliveryName: 'Customer',
          deliveryPhone: '01700000000',
          deliveryCity: 'Dhaka',
          grandTotal: 5000,
          items: [
            { productName: 'Dress', startDate: occurredAt, endDate: occurredAt },
          ],
        },
      },
    ]);
    shipment.count.mockResolvedValue(1);

    const result = await service.getDeliveryDashboard('tenant-1');

    expect(result.success).toBe(true);
    expect(result.summary).toEqual({ prepare_parcel: 2, in_transit: 1 });
    expect(result.stageSummary).toEqual({
      prepare_parcel: 2,
      awaiting_pickup: 0,
      in_transit: 1,
      delivered: 0,
      error: 0,
    });
    expect(result.data[0]).toMatchObject({
      shipmentId: 'shipment-1',
      bookingNumber: 'BK-001',
      deliveryStage: 'in_transit',
      courierStatus: 'in_transit',
    });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });
});
