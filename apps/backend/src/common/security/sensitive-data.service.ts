import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class SensitiveDataService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  /**
   * Values written before authenticated encryption was introduced are returned
   * unchanged. Any subsequent settings save rotates them into the v1 format.
   */
  decrypt(value: string): string {
    if (!value.startsWith('v1.')) return value;
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) {
      throw new Error('Unsupported encrypted value format');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  encryptJson<T>(value: T): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(value: string): T {
    return JSON.parse(this.decrypt(value)) as T;
  }

  private encryptionKey(): Buffer {
    const configured = this.config.get<string>('security.credentialsKey');
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    if (!configured && nodeEnv === 'production') {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY is required in production');
    }
    const material = configured || this.config.get<string>('jwt.secret', 'development-only-credentials-key');
    return createHash('sha256').update(material).digest();
  }
}
