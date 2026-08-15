import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

function build(prisma: Record<string, unknown>) {
  const jwt = { sign: jest.fn().mockReturnValue('impersonation-token') };
  const events = { emit: jest.fn() };
  return {
    service: new AdminService(prisma as never, jwt as never, events as never, {} as never),
    jwt,
    events,
  };
}

describe('AdminService billing integrity', () => {
  it('rejects invoices whose line-item arithmetic does not match the total', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      $transaction: jest.fn(),
    };
    const { service } = build(prisma);

    await expect(service.generateInvoice('tenant-1', {
      amount: 10_000,
      dueDate: '2099-01-01',
      lineItems: [{ description: 'Plan', quantity: 2, rate: 5_000, amount: 9_000 }],
    }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not link an invoice to a payment from another tenant', async () => {
    const prisma = {
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'invoice-1', tenantId: 'tenant-1', amount: 10_000, paidAt: null, paymentId: null }) },
      subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service } = build(prisma);
    await expect(service.updateInvoiceStatus('invoice-1', {
      status: 'paid',
      paymentId: '00000000-0000-4000-8000-000000000001',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscriptionPayment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '00000000-0000-4000-8000-000000000001', tenantId: 'tenant-1' },
    }));
  });

  it('requires a plan before recording a subscription payment', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', planId: null, subscription: null }) },
    };
    const { service } = build(prisma);
    await expect(service.recordPayment('tenant-1', {
      amount: 10_000,
      method: 'cash',
    }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminService impersonation', () => {
  it('issues a token backed by a short-lived, admin-attributed live session', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        businessName: 'Rental House',
        subdomain: 'rental-house',
        status: 'active',
        owner: { id: 'owner-1', isActive: true },
      }) },
      tenantUser: { findUnique: jest.fn().mockResolvedValue({ role: 'owner', isActive: true }) },
      session: { create: jest.fn().mockResolvedValue({ id: 'impersonation-session-1' }) },
    };
    const { service, jwt, events } = build(prisma);

    const result = await service.impersonateTenant('admin-1', 'tenant-1', {
      ip: '127.0.0.1',
      ua: { browser: 'Chrome', os: 'macOS', deviceType: 'desktop', deviceName: 'Chrome on macOS' },
    });

    expect(prisma.session.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'owner-1',
      isImpersonation: true,
      impersonatorId: 'admin-1',
      expiresAt: expect.any(Date),
    }) });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'impersonation-session-1',
      isImpersonation: true,
      impersonatorId: 'admin-1',
    }), { expiresIn: '1h' });
    expect(events.emit).toHaveBeenCalledWith('admin.tenantImpersonated', expect.objectContaining({
      impersonationSessionId: 'impersonation-session-1',
    }));
    expect(result.data.impersonationToken).toBe('impersonation-token');
  });
});

describe('AdminService tenant lifecycle integrity', () => {
  it('cancels the tenant, subscription, and sessions in one transaction', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'active',
          businessName: 'Rental House',
          planId: 'plan-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'tenant-1', status: 'cancelled' }),
      },
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      subscription: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const { service, events } = build(prisma);

    const result = await service.updateTenantStatus(
      'tenant-1',
      { status: 'cancelled', reason: 'Account closed' },
      'admin-1',
    );

    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } });
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', status: { not: 'cancelled' } },
    }));
    expect(events.emit).toHaveBeenCalledWith('admin.tenantStatusChanged', expect.objectContaining({
      oldStatus: 'active',
      newStatus: 'cancelled',
    }));
    expect(result.data.status).toBe('cancelled');
  });
});
