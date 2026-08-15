import { SensitiveDataService } from './sensitive-data.service';

describe('SensitiveDataService', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'security.credentialsKey') return 'unit-test-sensitive-data-key';
      if (key === 'nodeEnv') return 'test';
      return fallback;
    }),
  };
  const service = new SensitiveDataService(config as never);

  it('encrypts values with authenticated encryption and decrypts them', () => {
    const encrypted = service.encrypt('provider-secret');
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain('provider-secret');
    expect(service.decrypt(encrypted)).toBe('provider-secret');
  });

  it('accepts legacy plaintext until it is rotated on the next write', () => {
    expect(service.decrypt('legacy-plaintext')).toBe('legacy-plaintext');
  });

  it('rejects a modified authentication tag', () => {
    const parts = service.encrypt('provider-secret').split('.');
    parts[2] = Buffer.alloc(16).toString('base64url');
    expect(() => service.decrypt(parts.join('.'))).toThrow();
  });
});
