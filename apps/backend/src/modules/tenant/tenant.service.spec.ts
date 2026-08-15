import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SensitiveDataService } from '../../common/security/sensitive-data.service';
import { TenantService } from './tenant.service';

describe('TenantService payment settings', () => {
  const sensitiveData = new SensitiveDataService({
    get: jest.fn((key: string, fallback?: string) =>
      key === 'security.credentialsKey' ? 'unit-test-payment-key' : fallback),
  } as never);

  function build(existing: { sslcommerzStoreId: string | null; sslcommerzStorePass: string | null } | null) {
    const prisma = {
      storeSettings: {
        findUnique: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockResolvedValue({}),
      },
      tenant: { findUnique: jest.fn() },
    };
    const service = new TenantService(
      prisma as never,
      { emit: jest.fn() } as never,
      sensitiveData,
    );
    jest.spyOn(service, 'getStoreSettings').mockResolvedValue({ sslcommerzConfigured: true } as never);
    return { prisma, service };
  }

  it('keeps the stored password when the password field is blank', async () => {
    const existingSecret = sensitiveData.encrypt('existing-secret');
    const { prisma, service } = build({
      sslcommerzStoreId: 'store-id',
      sslcommerzStorePass: existingSecret,
    });

    await service.updatePaymentSettings('tenant-1', {
      sslcommerzStoreId: 'store-id',
      sslcommerzStorePass: '',
      sslcommerzSandbox: false,
    });

    expect(prisma.storeSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ sslcommerzStorePass: existingSecret }),
    }));
  });

  it('encrypts a replacement password before persistence', async () => {
    const { prisma, service } = build(null);
    await service.updatePaymentSettings('tenant-1', {
      sslcommerzStoreId: 'store-id',
      sslcommerzStorePass: 'new-secret',
    });

    const persisted = prisma.storeSettings.upsert.mock.calls[0][0].create.sslcommerzStorePass;
    expect(persisted).toMatch(/^v1\./);
    expect(persisted).not.toContain('new-secret');
    expect(sensitiveData.decrypt(persisted)).toBe('new-secret');
  });

  it('requires an ID and password pair and supports an explicit clear command', async () => {
    const incomplete = build(null);
    await expect(incomplete.service.updatePaymentSettings('tenant-1', {
      sslcommerzStoreId: 'store-id',
    })).rejects.toBeInstanceOf(BadRequestException);

    const configured = build({
      sslcommerzStoreId: 'store-id',
      sslcommerzStorePass: sensitiveData.encrypt('secret'),
    });
    await configured.service.updatePaymentSettings('tenant-1', {
      clearSslcommerzCredentials: true,
    });
    expect(configured.prisma.storeSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        sslcommerzStoreId: null,
        sslcommerzStorePass: null,
      }),
    }));
  });
});

describe('TenantService custom-domain lifecycle', () => {
  function build(prisma: Record<string, unknown>) {
    return new TenantService(
      prisma as never,
      { emit: jest.fn() } as never,
      {} as never,
    );
  }

  it('never resolves an unverified custom domain for storefront traffic', async () => {
    const prisma = { tenant: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = build(prisma);

    await expect(service.resolveByCustomDomain('shop.example.com')).resolves.toBeNull();
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        customDomain: 'shop.example.com',
        customDomainVerifiedAt: { not: null },
      },
    }));
  });

  it('enforces the plan entitlement before accepting a custom domain', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          plan: { customDomain: false },
          subscription: null,
        }),
      },
    };
    const service = build(prisma);

    await expect(service.setCustomDomain('tenant-1', 'shop.example.com'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks a newly configured domain as pending verification', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ plan: { customDomain: true }, subscription: null })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = build(prisma);

    const result = await service.setCustomDomain('tenant-1', 'Shop.Example.com.');

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: {
        customDomain: 'shop.example.com',
        customDomainVerifiedAt: null,
      },
    });
    expect(result.status).toBe('pending_verification');
  });
});
