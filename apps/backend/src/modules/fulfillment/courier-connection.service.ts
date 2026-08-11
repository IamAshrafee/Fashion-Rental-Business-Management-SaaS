import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ShipmentProvider } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCourierConnectionDto } from './dto/fulfillment.dto';
import { CourierSettings } from './providers/courier-provider.interface';
import { PathaoAdapter } from './providers/pathao.adapter';

type CredentialMap = Record<string, string>;

@Injectable()
export class CourierConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pathaoAdapter: PathaoAdapter,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.courierConnection.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { provider: 'asc' }],
    });
    return rows.map((row) => this.project(row));
  }

  async upsert(tenantId: string, provider: ShipmentProvider, dto: UpsertCourierConnectionDto) {
    if (provider === 'manual' && dto.isEnabled === false) {
      throw new BadRequestException('The manual delivery connection must remain available as a fallback');
    }
    const existing = await this.prisma.courierConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    const previousCredentials = existing?.credentialsEncrypted
      ? this.decrypt(existing.credentialsEncrypted)
      : {};
    const submitted = this.credentialsFor(provider, dto);
    const credentials = { ...previousCredentials, ...submitted };
    const config = this.configFor(provider, dto, existing?.config);
    this.assertComplete(provider, dto.isEnabled ?? existing?.isEnabled ?? false, config, credentials);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.courierConnection.updateMany({
          where: { tenantId, isDefault: true, provider: { not: provider } },
          data: { isDefault: false },
        });
      }
      const row = await tx.courierConnection.upsert({
        where: { tenantId_provider: { tenantId, provider } },
        update: {
          isEnabled: dto.isEnabled,
          isDefault: dto.isDefault,
          config,
          credentialsEncrypted: Object.keys(credentials).length ? this.encrypt(credentials) : null,
          healthStatus: 'not_tested',
          lastHealthCheckAt: null,
          lastHealthError: null,
        },
        create: {
          tenantId,
          provider,
          isEnabled: dto.isEnabled ?? provider === 'manual',
          isDefault: dto.isDefault ?? provider === 'manual',
          config,
          credentialsEncrypted: Object.keys(credentials).length ? this.encrypt(credentials) : null,
        },
      });
      return this.project(row);
    });
  }

  async test(tenantId: string, provider: ShipmentProvider) {
    const row = await this.prisma.courierConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!row) throw new NotFoundException('Courier connection not found');
    try {
      if (provider === 'pathao') {
        const settings = this.toSettings([row]);
        if (!settings.pathao?.enabled) throw new BadRequestException('Pathao credentials are incomplete');
        await this.pathaoAdapter.fetchToken(settings.pathao);
      } else if (provider === 'steadfast') {
        const credentials = row.credentialsEncrypted ? this.decrypt(row.credentialsEncrypted) : {};
        if (!credentials.apiKey || !credentials.secretKey) throw new BadRequestException('Steadfast credentials are incomplete');
      }
      const updated = await this.prisma.courierConnection.update({
        where: { id: row.id },
        data: { healthStatus: provider === 'steadfast' ? 'configured' : 'healthy', lastHealthCheckAt: new Date(), lastHealthError: null },
      });
      return this.project(updated);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Connection test failed';
      await this.prisma.courierConnection.update({
        where: { id: row.id },
        data: { healthStatus: 'unhealthy', lastHealthCheckAt: new Date(), lastHealthError: message.slice(0, 500) },
      });
      throw new BadRequestException(message);
    }
  }

  async getSettings(tenantId: string): Promise<CourierSettings> {
    const rows = await this.prisma.courierConnection.findMany({ where: { tenantId, isEnabled: true } });
    return this.toSettings(rows);
  }

  async resolveWebhookTenant(token: string, provider: ShipmentProvider) {
    const connection = await this.prisma.courierConnection.findFirst({
      where: { webhookToken: token, provider, isEnabled: true },
      select: { tenantId: true },
    });
    if (!connection) throw new NotFoundException('Webhook endpoint not found');
    return connection.tenantId;
  }

  private toSettings(rows: Array<{ provider: ShipmentProvider; isDefault: boolean; config: Prisma.JsonValue; credentialsEncrypted: string | null }>): CourierSettings {
    const result: CourierSettings = {};
    for (const row of rows) {
      if (row.isDefault) result.defaultProvider = row.provider;
      const config = this.jsonObject(row.config);
      const credentials = row.credentialsEncrypted ? this.decrypt(row.credentialsEncrypted) : {};
      if (row.provider === 'pathao') {
        result.pathao = {
          enabled: Boolean(credentials.clientId && credentials.clientSecret && credentials.username && credentials.password && config.storeId),
          clientId: credentials.clientId ?? '',
          clientSecret: credentials.clientSecret ?? '',
          username: credentials.username ?? '',
          password: credentials.password ?? '',
          defaultStoreId: typeof config.storeId === 'number' ? config.storeId : 0,
          sandbox: config.sandbox === true,
        };
      }
      if (row.provider === 'steadfast') {
        result.steadfast = {
          enabled: Boolean(credentials.apiKey && credentials.secretKey),
          apiKey: credentials.apiKey ?? '',
          secretKey: credentials.secretKey ?? '',
        };
      }
    }
    return result;
  }

  private credentialsFor(provider: ShipmentProvider, dto: UpsertCourierConnectionDto): CredentialMap {
    const pairs = provider === 'pathao'
      ? { clientId: dto.clientId, clientSecret: dto.clientSecret, username: dto.username, password: dto.password }
      : provider === 'steadfast'
        ? { apiKey: dto.apiKey, secretKey: dto.secretKey }
        : {};
    return Object.fromEntries(Object.entries(pairs).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())).map(([key, value]) => [key, value.trim()]));
  }

  private configFor(provider: ShipmentProvider, dto: UpsertCourierConnectionDto, previous: Prisma.JsonValue | undefined) {
    const current = this.jsonObject(previous);
    if (provider === 'pathao') {
      return { ...current, ...(dto.storeId !== undefined ? { storeId: dto.storeId } : {}), ...(dto.sandbox !== undefined ? { sandbox: dto.sandbox } : {}) } as Prisma.InputJsonValue;
    }
    return current as Prisma.InputJsonValue;
  }

  private assertComplete(provider: ShipmentProvider, enabled: boolean, config: Prisma.InputJsonValue, credentials: CredentialMap) {
    if (!enabled || provider === 'manual') return;
    const values = this.jsonObject(config);
    if (provider === 'pathao' && (!credentials.clientId || !credentials.clientSecret || !credentials.username || !credentials.password || !values.storeId)) {
      throw new BadRequestException('Client ID, client secret, username, password, and store ID are required to enable Pathao');
    }
    if (provider === 'steadfast' && (!credentials.apiKey || !credentials.secretKey)) {
      throw new BadRequestException('API key and secret key are required to enable Steadfast');
    }
  }

  private project(row: { id: string; provider: ShipmentProvider; isEnabled: boolean; isDefault: boolean; config: Prisma.JsonValue; credentialsEncrypted: string | null; webhookToken: string; healthStatus: string; lastHealthCheckAt: Date | null; lastHealthError: string | null; updatedAt: Date }) {
    return {
      id: row.id,
      provider: row.provider,
      isEnabled: row.isEnabled,
      isDefault: row.isDefault,
      config: this.jsonObject(row.config),
      hasCredentials: Boolean(row.credentialsEncrypted),
      webhookToken: row.webhookToken,
      healthStatus: row.healthStatus,
      lastHealthCheckAt: row.lastHealthCheckAt,
      lastHealthError: row.lastHealthError,
      updatedAt: row.updatedAt,
    };
  }

  private encryptionKey() {
    const configured = this.config.get<string>('security.courierCredentialsKey');
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    if (!configured && nodeEnv === 'production') {
      throw new Error('COURIER_CREDENTIALS_ENCRYPTION_KEY is required in production');
    }
    const material = configured || this.config.get<string>('jwt.secret', 'development-only-courier-key');
    return createHash('sha256').update(material).digest();
  }

  private encrypt(credentials: CredentialMap) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  }

  private decrypt(value: string): CredentialMap {
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Unsupported courier credential format');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as CredentialMap;
  }

  private jsonObject(value: Prisma.JsonValue | Prisma.InputJsonValue | undefined): Prisma.JsonObject {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as unknown as Prisma.JsonObject : {};
  }
}
