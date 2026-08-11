import { of } from 'rxjs';
import { PathaoAdapter, normalisePathaoStatus } from './pathao.adapter';
import { SteadfastAdapter } from './steadfast.adapter';

describe('courier adapter money and payload boundaries', () => {
  it('uses Pathao auto-address payloads and converts minor BDT to taka', async () => {
    const http = {
      post: jest.fn()
        .mockReturnValueOnce(of({ data: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 } }))
        .mockReturnValueOnce(of({ data: { code: 200, message: 'ok', data: { consignment_id: 'PTH-1', order_status: 'Pending', delivery_fee: 80 } } })),
    };
    const adapter = new PathaoAdapter(http as never);
    const result = await adapter.createParcel({
      merchantOrderId: 'ORD-1',
      recipientName: 'Rental Customer',
      recipientPhone: '01712345678',
      recipientAddress: 'House 1, Road 2, Dhanmondi',
      recipientCity: 'Dhaka',
      codAmount: 90_000,
      itemQuantity: 2,
      weightKg: 1,
    }, {
      enabled: true,
      clientId: 'client',
      clientSecret: 'secret',
      username: 'merchant@example.test',
      password: 'password',
      defaultStoreId: 10,
      sandbox: false,
    });
    const orderPayload = http.post.mock.calls[1][1];
    expect(orderPayload).toMatchObject({ amount_to_collect: 900, store_id: 10, delivery_type: 48, item_type: 2 });
    expect(orderPayload).not.toHaveProperty('recipient_city');
    expect(orderPayload).not.toHaveProperty('recipient_zone');
    expect(result).toMatchObject({ trackingId: 'PTH-1', deliveryFee: 8_000 });
  });

  it('converts minor BDT before creating a Steadfast order', async () => {
    const http = {
      post: jest.fn().mockReturnValue(of({ data: { status: 200, message: 'ok', consignment: { consignment_id: 1, tracking_code: 'SF-1', status: 'pending' } } })),
    };
    const adapter = new SteadfastAdapter(http as never);
    await adapter.createParcel({
      merchantOrderId: 'ORD-2',
      recipientName: 'Rental Customer',
      recipientPhone: '01712345678',
      recipientAddress: 'Dhaka, Bangladesh',
      recipientCity: 'Dhaka',
      codAmount: 25_050,
    }, { enabled: true, apiKey: 'key', secretKey: 'secret' });
    expect(http.post.mock.calls[0][1]).toMatchObject({ cod_amount: 250.5, invoice: 'ORD-2' });
  });

  it('normalises specific Pathao states before broad delivered matching', () => {
    expect(normalisePathaoStatus('Partial Delivered')).toBe('partial_delivered');
    expect(normalisePathaoStatus('Out for Delivery')).toBe('out_for_delivery');
    expect(normalisePathaoStatus('Delivered')).toBe('delivered');
  });
});
