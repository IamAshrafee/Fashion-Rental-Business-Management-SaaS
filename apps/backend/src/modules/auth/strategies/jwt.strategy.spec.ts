import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

const payload = {
  sub: 'user-1',
  tenantId: 'tenant-1',
  role: 'owner' as const,
  sessionId: 'session-1',
};

function makeStrategy(session: unknown, membership: unknown = null) {
  const prisma = {
    session: { findFirst: jest.fn().mockResolvedValue(session) },
    tenantUser: { findUnique: jest.fn().mockResolvedValue(membership) },
  };
  const config = { get: jest.fn((_key, fallback) => fallback) };
  return { strategy: new JwtStrategy(config as never, prisma as never), prisma };
}

describe('JwtStrategy live session validation', () => {
  it('rejects a revoked or expired session immediately', async () => {
    const { strategy } = makeStrategy(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses the current active membership role instead of a stale token role', async () => {
    const { strategy } = makeStrategy(
      { tenantId: 'tenant-1', user: { role: 'owner' } },
      { isActive: true, role: 'manager', tenant: { status: 'active' } },
    );
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'manager',
      sessionId: 'session-1',
    });
  });

  it('rejects inactive membership even while the signed access token is unexpired', async () => {
    const { strategy } = makeStrategy(
      { tenantId: 'tenant-1', user: { role: 'owner' } },
      { isActive: false, role: 'owner', tenant: { status: 'active' } },
    );
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts an impersonation token only when its live admin-backed session matches', async () => {
    const { strategy } = makeStrategy(
      {
        tenantId: 'tenant-1',
        isImpersonation: true,
        impersonatorId: 'admin-1',
        impersonator: { role: 'saas_admin', isActive: true },
        user: { role: 'owner' },
      },
      { isActive: true, role: 'owner', tenant: { status: 'active' } },
    );
    await expect(strategy.validate({
      ...payload,
      isImpersonation: true,
      impersonatorId: 'admin-1',
    })).resolves.toMatchObject({
      isImpersonation: true,
      impersonatorId: 'admin-1',
      tenantId: 'tenant-1',
    });
  });

  it('rejects fabricated or stale impersonation metadata', async () => {
    const { strategy } = makeStrategy({
      tenantId: 'tenant-1',
      isImpersonation: true,
      impersonatorId: 'admin-1',
      impersonator: { role: 'saas_admin', isActive: false },
      user: { role: 'owner' },
    });
    await expect(strategy.validate({
      ...payload,
      isImpersonation: true,
      impersonatorId: 'admin-1',
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
