import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordPaymentDto, ReviewPaymentClaimDto } from './payment.dto';

describe('payment DTO business rules', () => {
  it('accepts only manual methods on the manual payment endpoint', async () => {
    const dto = plainToInstance(RecordPaymentDto, { amount: 5000, method: 'sslcommerz' });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'method' })]),
    );
  });

  it('requires a transaction ID for mobile payments but not cash', async () => {
    const mobile = plainToInstance(RecordPaymentDto, { amount: 5000, method: 'bkash' });
    const cash = plainToInstance(RecordPaymentDto, { amount: 5000, method: 'cod' });

    expect(await validate(mobile)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'transactionId' })]),
    );
    await expect(validate(cash)).resolves.toEqual([]);
  });

  it('requires a reason when rejecting a customer payment claim', async () => {
    const rejection = plainToInstance(ReviewPaymentClaimDto, { approve: false });
    const approval = plainToInstance(ReviewPaymentClaimDto, { approve: true });

    expect(await validate(rejection)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'reason' })]),
    );
    await expect(validate(approval)).resolves.toEqual([]);
  });
});
