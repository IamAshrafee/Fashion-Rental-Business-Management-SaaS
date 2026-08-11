import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { FulfillmentService } from '../src/modules/fulfillment/fulfillment.service';
import { CourierProviderEnum } from '../src/modules/fulfillment/dto/fulfillment.dto';

describe('shipment operational domain', () => {
  const prisma = new PrismaClient();
  const updateStatus = jest.fn(async (_tenantId: string, _bookingId: string, status: string) => ({ status }));
  const service = new FulfillmentService(
    prisma as never,
    { updateStatus } as never,
    {} as never,
    {} as never,
    { createParcel: jest.fn(async () => ({ trackingId: `MAN-${randomUUID()}`, status: 'created', deliveryFee: 0 })), trackParcel: jest.fn() } as never,
    { emit: jest.fn() } as never,
  );

  afterAll(async () => prisma.$disconnect());

  it('creates one auditable parcel and processes authenticated webhooks exactly once', async () => {
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const owner = await prisma.user.create({
      data: { fullName: 'Shipment Owner', email: `shipment-${suffix}@example.test`, passwordHash: 'integration' },
    });
    const tenant = await prisma.tenant.create({
      data: { businessName: 'Shipment Store', subdomain: `shipment-${suffix}`, ownerUserId: owner.id },
    });
    const settings = await prisma.storeSettings.create({
      data: { tenantId: tenant.id, defaultCourier: 'steadfast' },
    });
    const customer = await prisma.customer.create({
      data: { tenantId: tenant.id, fullName: 'Shipment Customer' },
    });
    const booking = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        bookingNumber: `SHIP-${suffix}`,
        status: 'confirmed',
        paymentMethod: 'cod',
        subtotal: 25_000,
        grandTotal: 25_000,
        deliveryName: 'Shipment Customer',
        deliveryPhone: '01712345678',
        deliveryAddressLine1: '12 Dispatch Road',
        deliveryCity: 'Dhaka',
        deliveryCountry: 'BD',
      },
    });

    const dispatched = await service.sendPickupNow(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.STEADFAST,
      useApi: false,
      trackingNumber: `SF-${suffix}`,
      codAmount: 25_000,
    });
    expect(dispatched).toMatchObject({ bookingNumber: booking.bookingNumber, courierStatus: 'pickup_pending', courierProvider: 'steadfast' });
    await expect(service.sendPickupNow(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.STEADFAST,
      useApi: false,
      trackingNumber: `SF-OTHER-${suffix}`,
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SHIPMENT_ALREADY_DISPATCHED' }) });

    const webhook = {
      tracking_code: `SF-${suffix}`,
      invoice: booking.bookingNumber,
      delivery_status: 'delivered',
      updated_at: new Date().toISOString(),
    };
    await service.processSteadfastWebhook(settings.courierWebhookToken, webhook);
    await service.processSteadfastWebhook(settings.courierWebhookToken, webhook);

    const shipment = await prisma.shipment.findFirstOrThrow({
      where: { bookingId: booking.id },
      include: { events: true, webhookReceipts: true },
    });
    expect(shipment.status).toBe('delivered');
    expect(shipment.events.filter((event) => event.source === 'webhook')).toHaveLength(1);
    expect(shipment.webhookReceipts).toHaveLength(1);
    expect(updateStatus).toHaveBeenCalledTimes(1);
  });
});
