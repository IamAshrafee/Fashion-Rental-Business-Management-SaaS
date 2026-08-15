import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CourierConnectionService } from './courier-connection.service';
import { SensitiveDataService } from '../../common/security/sensitive-data.service';

const row = {
  id: 'connection-1',
  provider: 'steadfast' as const,
  isEnabled: true,
  isDefault: true,
  config: {},
  credentialsEncrypted: null as string | null,
  webhookToken: 'private-webhook-token',
  healthStatus: 'not_tested',
  lastHealthCheckAt: null,
  lastHealthError: null,
  updatedAt: new Date('2026-08-11T00:00:00Z'),
};

describe('CourierConnectionService', () => {
  function build(overrides?: { nodeEnv?: string; encryptionKey?: string }) {
    const tx = {
      courierConnection: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(async (args) => ({ ...row, ...args.create, credentialsEncrypted: args.create.credentialsEncrypted })),
      },
    };
    const prisma = {
      courierConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'nodeEnv') return overrides?.nodeEnv ?? 'test';
        if (key === 'security.credentialsKey') return overrides?.encryptionKey ?? 'unit-test-courier-key';
        if (key === 'jwt.secret') return 'unit-test-jwt-key';
        return fallback;
      }),
    };
    return {
      prisma,
      tx,
      service: new CourierConnectionService(
        prisma as never,
        {} as never,
        new SensitiveDataService(config as never),
      ),
    };
  }

  it('encrypts provider credentials and never returns them to the owner projection', async () => {
    const { service, tx } = build();
    const result = await service.upsert('tenant-1', 'steadfast', {
      isEnabled: true,
      isDefault: true,
      apiKey: 'api-secret-value',
      secretKey: 'second-secret-value',
    });
    const persisted = tx.courierConnection.upsert.mock.calls[0][0].create.credentialsEncrypted as string;
    expect(persisted).toMatch(/^v1\./);
    expect(persisted).not.toContain('api-secret-value');
    expect(result).toMatchObject({ provider: 'steadfast', hasCredentials: true });
    expect(result).not.toHaveProperty('credentialsEncrypted');
    expect(result).not.toHaveProperty('apiKey');
    expect(tx.courierConnection.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', isDefault: true, provider: { not: 'steadfast' } },
    }));
  });

  it('refuses an enabled provider when required credentials are incomplete', async () => {
    const { service } = build();
    await expect(service.upsert('tenant-1', 'pathao', {
      isEnabled: true,
      storeId: 10,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves webhook capability tokens only for the requested enabled provider', async () => {
    const { service, prisma } = build();
    prisma.courierConnection.findFirst.mockResolvedValueOnce({ tenantId: 'tenant-1' });
    await expect(service.resolveWebhookTenant('capability', 'pathao')).resolves.toBe('tenant-1');
    expect(prisma.courierConnection.findFirst).toHaveBeenCalledWith({
      where: { webhookToken: 'capability', provider: 'pathao', isEnabled: true },
      select: { tenantId: true },
    });
    prisma.courierConnection.findFirst.mockResolvedValueOnce(null);
    await expect(service.resolveWebhookTenant('wrong', 'pathao')).rejects.toBeInstanceOf(NotFoundException);
  });
});
