import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from './payment.service';

describe('PaymentService callback confirmation', () => {
  const payment = { findFirst: jest.fn() };
  const service = new PaymentService(
    { payment } as unknown as PrismaService,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('looks up confirmation details by an exact active SSLCommerz transaction', async () => {
    payment.findFirst.mockResolvedValue(null);

    await expect(
      service.getBookingConfirmationForTransaction('BOOKING-forged'),
    ).resolves.toBeNull();
    expect(payment.findFirst).toHaveBeenCalledWith({
      where: {
        transactionId: 'BOOKING-forged',
        method: 'sslcommerz',
        status: { in: ['pending', 'verified'] },
      },
      select: {
        status: true,
        booking: { select: { bookingNumber: true, publicTrackingToken: true } },
      },
    });
  });
});
