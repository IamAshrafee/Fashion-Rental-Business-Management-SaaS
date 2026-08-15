import { firstValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { ResponseTransformInterceptor } from './response-transform.interceptor';

describe('ResponseTransformInterceptor', () => {
  const context = {} as ExecutionContext;
  const interceptor = new ResponseTransformInterceptor();

  it('keeps pagination metadata at the response envelope level', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () =>
          of({
            data: [{ id: 'item-1' }],
            meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
          }),
      } as CallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: [{ id: 'item-1' }],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
  });

  it('preserves contextual fields on paginated service responses', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () =>
          of({
            summary: { total: 2 },
            stageSummary: { pending: 1, delivered: 1 },
            data: [{ id: 'delivery-1' }, { id: 'delivery-2' }],
            meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
          }),
      } as CallHandler),
    );

    expect(result).toEqual({
      success: true,
      summary: { total: 2 },
      stageSummary: { pending: 1, delivered: 1 },
      data: [{ id: 'delivery-1' }, { id: 'delivery-2' }],
      meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
    });
  });

  it('wraps ordinary values inside the data field', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ id: 'location-1' }),
      } as CallHandler),
    );

    expect(result).toEqual({ success: true, data: { id: 'location-1' } });
  });
});
