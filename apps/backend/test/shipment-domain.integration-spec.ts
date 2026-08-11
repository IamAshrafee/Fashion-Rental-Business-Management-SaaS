import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { FulfillmentService } from '../src/modules/fulfillment/fulfillment.service';
import { CourierProviderEnum } from '../src/modules/fulfillment/dto/fulfillment.dto';
import { CourierConnectionService } from '../src/modules/fulfillment/courier-connection.service';

describe('shipment operational domain', () => {
  const prisma = new PrismaClient();
  const updateStatus = jest.fn(async (_tenantId: string, _bookingId: string, status: string) => ({ status }));
  const connections = new CourierConnectionService(
    prisma as never,
    { get: jest.fn((key: string, fallback?: string) => key === 'nodeEnv' ? 'test' : key === 'jwt.secret' ? 'integration-courier-secret' : fallback) } as never,
    {} as never,
  );
  const service = new FulfillmentService(
    prisma as never,
    connections,
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
    await prisma.storeSettings.create({
      data: { tenantId: tenant.id, phone: '01800000000', pickupAddress: 'Returns Desk, 9 Store Road', pickupCity: 'Dhaka' },
    });
    const connection = await connections.upsert(tenant.id, 'steadfast', {
      isEnabled: true,
      isDefault: true,
      apiKey: 'integration-api-key',
      secretKey: 'integration-secret-key',
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
        returnMethod: 'BUSINESS_PICKUP',
      },
    });

    const dispatchKey = randomUUID();
    const dispatched = await service.sendPickupNow(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.STEADFAST,
      useApi: false,
      trackingNumber: `SF-${suffix}`,
      codAmount: 25_000,
    }, dispatchKey);
    expect(dispatched).toMatchObject({ bookingNumber: booking.bookingNumber, courierStatus: 'pickup_pending', courierProvider: 'steadfast' });
    await expect(service.sendPickupNow(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.STEADFAST,
      useApi: false,
      trackingNumber: `SF-${suffix}`,
      codAmount: 25_000,
    }, dispatchKey)).resolves.toMatchObject({ courierStatus: 'pickup_pending' });
    await expect(service.sendPickupNow(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.STEADFAST,
      useApi: false,
      trackingNumber: `SF-OTHER-${suffix}`,
    }, randomUUID())).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SHIPMENT_ALREADY_DISPATCHED' }) });

    const webhook = {
      tracking_code: `SF-${suffix}`,
      invoice: booking.bookingNumber,
      delivery_status: 'delivered',
      updated_at: new Date().toISOString(),
    };
    await service.processSteadfastWebhook(connection.webhookToken, webhook);
    await service.processSteadfastWebhook(connection.webhookToken, webhook);
    await service.processSteadfastWebhook(connection.webhookToken, {
      ...webhook,
      delivery_status: 'in_transit',
      updated_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const shipment = await prisma.shipment.findFirstOrThrow({
      where: { bookingId: booking.id, direction: 'OUTBOUND' },
      include: { events: true, webhookReceipts: true, dispatchAttempts: true, codRemittance: { include: { payment: true } } },
    });
    expect(shipment.status).toBe('delivered');
    expect(shipment.events.filter((event) => event.source === 'webhook')).toHaveLength(2);
    expect(shipment.events.some((event) => event.label.startsWith('Ignored stale provider update'))).toBe(true);
    expect(shipment.webhookReceipts).toHaveLength(2);
    expect(shipment.dispatchAttempts).toHaveLength(1);
    expect(shipment.dispatchAttempts[0].status).toBe('SUCCEEDED');
    expect(shipment.codRemittance?.payment).toMatchObject({ amount: 25_000, status: 'verified' });
    const paidBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(paidBooking).toMatchObject({ totalPaid: 25_000, paymentStatus: 'paid' });
    expect(updateStatus).toHaveBeenCalledTimes(1);

    const reconciled = await service.reconcileCod(tenant.id, shipment.codRemittance!.id, {
      remittedAmount: 24_000,
      feeDeducted: 1_000,
      providerReference: `SETTLE-${suffix}`,
      remittedAt: new Date().toISOString(),
    }, owner.id);
    expect(reconciled).toMatchObject({ status: 'RECONCILED', remittedAmount: 24_000, feeDeducted: 1_000 });

    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'delivered' } });
    const returned = await service.createReturnShipment(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.MANUAL,
      specialInstruction: 'Call customer before pickup',
    }, randomUUID());
    expect(returned).toMatchObject({ direction: 'RETURN', courierStatus: 'prepare_parcel' });
    await expect(service.createReturnShipment(tenant.id, booking.id, {
      courierProvider: CourierProviderEnum.MANUAL,
    }, randomUUID())).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RETURN_SHIPMENT_EXISTS' }) });
  });
});
