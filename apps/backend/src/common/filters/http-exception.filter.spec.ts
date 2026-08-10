import { ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('preserves machine-readable conflict identity and structured details', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ method: 'PATCH', url: '/owner/example' }),
      }),
    };

    new HttpExceptionFilter().catch(new ConflictException({
      code: 'RENTAL_EXTENSION_CONFLICT',
      message: 'One component is unavailable',
      requirementId: 'requirement-1',
      reason: 'Already reserved',
    }), host as never);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'RENTAL_EXTENSION_CONFLICT',
        message: 'One component is unavailable',
        details: { requirementId: 'requirement-1', reason: 'Already reserved' },
      },
    });
  });
});
