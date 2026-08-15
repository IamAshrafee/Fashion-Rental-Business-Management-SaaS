import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentService } from './fulfillment.service';

describe('FulfillmentService delivery dashboard', () => {
  const shipment = {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const transaction = jest.fn();
  const service = new FulfillmentService(
    { shipment, $transaction: transaction } as unknown as PrismaService,
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

  it('requires a remittance date when money is accounted', async () => {
    await expect(
      service.reconcileCod(
        'tenant-1',
        'remittance-1',
        { remittedAmount: 5000, feeDeducted: 0 },
        'user-1',
      ),
    ).rejects.toThrow('Remittance date is required');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a future remittance date', async () => {
    await expect(
      service.reconcileCod(
        'tenant-1',
        'remittance-1',
        { remittedAmount: 5000, remittedAt: '2999-01-01' },
        'user-1',
      ),
    ).rejects.toThrow('Remittance date cannot be in the future');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('records a fully accounted settlement with the authenticated actor', async () => {
    const codRemittance = {
      findFirst: jest.fn().mockResolvedValue({ expectedAmount: 5000 }),
      update: jest.fn().mockResolvedValue({ id: 'remittance-1', status: 'RECONCILED' }),
    };
    const tx = { $queryRaw: jest.fn(), codRemittance };
    transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await service.reconcileCod(
      'tenant-1',
      'remittance-1',
      {
        remittedAmount: 4500,
        feeDeducted: 500,
        remittedAt: '2026-01-01',
        providerReference: ' SETTLEMENT-1 ',
      },
      'user-1',
    );

    expect(codRemittance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'remittance-1' },
        data: expect.objectContaining({
          status: 'RECONCILED',
          remittedAmount: 4500,
          feeDeducted: 500,
          providerReference: 'SETTLEMENT-1',
          reconciledById: 'user-1',
          reconciledAt: expect.any(Date),
        }),
      }),
    );
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
