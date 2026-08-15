import { BadRequestException } from '@nestjs/common';
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
