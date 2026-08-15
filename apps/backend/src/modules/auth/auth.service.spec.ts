import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

function makeService() {
  const tx = {
    $queryRaw: jest.fn(),
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'reset-1' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'reset-1' }),
    },
    user: { update: jest.fn() },
    session: { deleteMany: jest.fn() },
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      update: jest.fn(),
    },
    loginHistory: { create: jest.fn() },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const config = {
    get: jest.fn((key: string, fallback: unknown) => (key === 'bcryptSaltRounds' ? 4 : fallback)),
  };
  const events = { emit: jest.fn() };
  return {
    service: new AuthService(
      prisma as never,
      {} as never,
      config as never,
      events as never,
      {} as never,
    ),
    prisma,
    tx,
    events,
  };
}

describe('AuthService password recovery', () => {
  it('stores only a digest and invalidates earlier unused reset tokens', async () => {
    const { service, tx, events } = makeService();
    await service.forgotPassword({ identifier: '01700000000' });

    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const created = tx.passwordResetToken.create.mock.calls[0][0].data;
    expect(created.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
    const emittedToken = events.emit.mock.calls.find(
      ([name]) => name === 'auth.passwordResetRequested',
    )?.[1].resetToken;
    expect(emittedToken).toBeTruthy();
    expect(created.tokenDigest).not.toBe(emittedToken);
  });

  it('consumes a valid token once, changes the password, and revokes every session', async () => {
    const { service, tx } = makeService();
    await expect(
      service.resetPassword({
        identifier: '01700000000',
        token: 'one-time-secret',
        newPassword: 'Secure123',
      }),
    ).resolves.toEqual({ message: 'Password reset successful' });

    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'reset-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: expect.any(String) },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('rejects an expired or already-consumed reset token', async () => {
    const { service, tx } = makeService();
    tx.passwordResetToken.findFirst.mockResolvedValue(null);
    await expect(
      service.resetPassword({
        identifier: '01700000000',
        token: 'used-secret',
        newPassword: 'Secure123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService tenant-aware login', () => {
  it('returns the requested tenant as the authoritative current context', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      fullName: 'Team Member',
      email: 'member@example.com',
      phone: '01700000000',
      passwordHash: await bcrypt.hash('Secure123', 4),
      role: 'staff',
      isActive: true,
      tenantUsers: [
        {
          tenantId: 'tenant-a',
          role: 'staff',
          permissions: ['manage_inventory'],
          tenant: { id: 'tenant-a', businessName: 'A', subdomain: 'a-store', customDomain: null, logoUrl: null, status: 'active', statusReason: null },
        },
        {
          tenantId: 'tenant-b',
          role: 'manager',
          permissions: ['manage_bookings'],
          tenant: { id: 'tenant-b', businessName: 'B', subdomain: 'b-store', customDomain: 'b.example.com', logoUrl: '/b.png', status: 'active', statusReason: null },
        },
      ],
    });
    (service as unknown as { enforceSessionLimits: jest.Mock }).enforceSessionLimits = jest.fn();
    (service as unknown as { createSession: jest.Mock }).createSession = jest.fn().mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await service.login(
      { identifier: 'member@example.com', password: 'Secure123', tenantSlug: 'b-store' },
      { ua: { deviceType: 'desktop' } as never, ip: '127.0.0.1' },
    );

    expect(result.tenantId).toBe('tenant-b');
    expect(result.user).toMatchObject({
      tenantId: 'tenant-b',
      role: 'manager',
      permissions: ['manage_bookings'],
      currentTenant: { id: 'tenant-b', subdomain: 'b-store' },
    });
  });
});
