import { ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

function context(request: Record<string, unknown>) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('TenantGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const guard = new TenantGuard(reflector as never);

  it('rejects a tenant-less owner token in an active store context', () => {
    expect(() =>
      guard.canActivate(
        context({
          tenant: { id: 'tenant-1' },
          user: { id: 'user-1', role: 'owner', tenantId: null },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a token issued for another tenant', () => {
    expect(() =>
      guard.canActivate(
        context({
          tenant: { id: 'tenant-1' },
          user: { id: 'user-1', role: 'manager', tenantId: 'tenant-2' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts an exact tenant match and preserves SaaS-admin access', () => {
    expect(
      guard.canActivate(
        context({
          tenant: { id: 'tenant-1' },
          user: { id: 'user-1', role: 'staff', tenantId: 'tenant-1' },
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        context({
          tenant: { id: 'tenant-1' },
          user: { id: 'admin-1', role: 'saas_admin', tenantId: null },
        }),
      ),
    ).toBe(true);
  });
});
