import { lastValueFrom, of, throwError } from 'rxjs';
import { ImpersonationAuditInterceptor } from './impersonation-audit.interceptor';

function buildRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: 'PATCH',
    baseUrl: '/api/v1/products',
    path: '/product-1',
    route: { path: '/:id' },
    params: { id: 'product-1' },
    headers: { 'user-agent': 'Test browser' },
    ip: '127.0.0.1',
    user: {
      id: 'owner-1',
      role: 'owner',
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      isImpersonation: true,
      impersonatorId: 'admin-1',
    },
    ...overrides,
  };
}

function contextFor(request: ReturnType<typeof buildRequest>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('ImpersonationAuditInterceptor', () => {
  it('attributes successful impersonated mutations to the SaaS administrator', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const interceptor = new ImpersonationAuditInterceptor(prisma as never);

    await expect(lastValueFrom(interceptor.intercept(
      contextFor(buildRequest()),
      { handle: () => of({ success: true }) },
    ))).resolves.toEqual({ success: true });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'admin-1',
        action: 'admin.impersonated_patch',
        entityType: 'http_route',
        entityId: 'product-1',
        newValues: expect.objectContaining({
          targetUserId: 'owner-1',
          impersonationSessionId: 'session-1',
        }),
      }),
    });
  });

  it('does not audit reads', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const interceptor = new ImpersonationAuditInterceptor(prisma as never);

    await lastValueFrom(interceptor.intercept(
      contextFor(buildRequest({ method: 'GET' })),
      { handle: () => of({ success: true }) },
    ));

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not record a mutation that failed', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const interceptor = new ImpersonationAuditInterceptor(prisma as never);

    await expect(lastValueFrom(interceptor.intercept(
      contextFor(buildRequest()),
      { handle: () => throwError(() => new Error('mutation failed')) },
    ))).rejects.toThrow('mutation failed');

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
