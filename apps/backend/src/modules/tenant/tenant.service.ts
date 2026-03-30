import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '@closetrent/types';
import {
  UpdateStoreSettingsDto,
  UpdateLocaleSettingsDto,
  UpdatePaymentSettingsDto,
  UpdateCourierSettingsDto,
  UpdateOperationalSettingsDto,
} from './dto/update-settings.dto';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolveCname = promisify(dns.resolveCname);

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================================
  // TENANT RESOLUTION (used by TenantMiddleware)
  // =========================================================================

  /**
   * Resolve a tenant by subdomain. Returns tenant context for middleware.
   */
  async resolveBySubdomain(subdomain: string): Promise<TenantContext | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        status: true,
      },
    });

    if (!tenant) return null;
    return tenant as TenantContext;
  }

  /**
   * Resolve a tenant by custom domain.
   */
  async resolveByCustomDomain(domain: string): Promise<TenantContext | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { customDomain: domain },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        status: true,
      },
    });

    if (!tenant) return null;
    return tenant as TenantContext;
  }

  /**
   * Get full tenant details by ID (for authenticated endpoints).
   */
  async findById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        storeSettings: true,
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            maxProducts: true,
            maxStaff: true,
            customDomain: true,
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Check if a subdomain is available.
   */
  async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    const reserved = [
      'admin', 'api', 'www', 'app', 'mail', 'ftp', 'blog',
      'help', 'support', 'docs', 'status', 'billing',
      'closetrent', 'dashboard',
    ];

    if (reserved.includes(subdomain.toLowerCase())) {
      return false;
    }

    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Validate tenant status. Throws if suspended or cancelled.
   */
  validateTenantStatus(tenant: TenantContext): void {
    if (tenant.status === 'suspended') {
      throw new ForbiddenException(
        'This store has been suspended. Please contact support.',
      );
    }

    if (tenant.status === 'cancelled') {
      throw new ForbiddenException(
        'This store is no longer active.',
      );
    }
  }

  /**
   * Get the max concurrent sessions setting for a tenant.
   */
  async getMaxConcurrentSessions(tenantId: string): Promise<number> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: { maxConcurrentSessions: true },
    });

    return settings?.maxConcurrentSessions ?? 5;
  }

  // =========================================================================
  // STORE SETTINGS — GET
  // =========================================================================

  /**
   * Get full store settings (owner-facing).
   * Returns a flat object with tenant + settings fields merged at root.
   * Excludes raw secrets — sensitive credentials are never sent to the browser.
   */
  async getStoreSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        customDomain: true,
        logoUrl: true,
        faviconUrl: true,
        storeSettings: {
          select: {
            id: true,
            tenantId: true,
            primaryColor: true,
            secondaryColor: true,
            tagline: true,
            about: true,
            phone: true,
            whatsapp: true,
            email: true,
            address: true,
            facebookUrl: true,
            instagramUrl: true,
            tiktokUrl: true,
            youtubeUrl: true,
            defaultLanguage: true,
            timezone: true,
            country: true,
            currencyCode: true,
            currencySymbol: true,
            currencyPosition: true,
            numberFormat: true,
            dateFormat: true,
            timeFormat: true,
            weekStart: true,
            smsEnabled: true,
            bkashNumber: true,
            nagadNumber: true,
            sslcommerzStoreId: true,
            // sslcommerzStorePass: EXCLUDED — secret
            sslcommerzSandbox: true,
            defaultCourier: true,
            // courierApiKey: EXCLUDED — secret
            // courierSecretKey: EXCLUDED — secret
            pickupAddress: true,
            maxConcurrentSessions: true,
            bufferDays: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Flatten: spread storeSettings fields at root level
    const { storeSettings, ...tenantFields } = tenant;
    return {
      ...tenantFields,
      ...storeSettings,
    };
  }

  /**
   * Get public store info for storefront rendering (no sensitive data).
   * Cached in Redis with 5 min TTL in production.
   */
  async getPublicStoreInfo(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        customDomain: true,
        logoUrl: true,
        faviconUrl: true,
        storeSettings: {
          select: {
            primaryColor: true,
            secondaryColor: true,
            tagline: true,
            about: true,
            phone: true,
            whatsapp: true,
            email: true,
            address: true,
            facebookUrl: true,
            instagramUrl: true,
            tiktokUrl: true,
            youtubeUrl: true,
            defaultLanguage: true,
            timezone: true,
            country: true,
            currencyCode: true,
            currencySymbol: true,
            currencyPosition: true,
            numberFormat: true,
            dateFormat: true,
            timeFormat: true,
            weekStart: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Store not found');
    }

    const settings = tenant.storeSettings;

    return {
      id: tenant.id,
      businessName: tenant.businessName,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: settings?.primaryColor ?? '#6366F1',
      secondaryColor: settings?.secondaryColor ?? '#EC4899',
      tagline: settings?.tagline ?? null,
      about: settings?.about ?? null,
      phone: settings?.phone ?? null,
      whatsapp: settings?.whatsapp ?? null,
      email: settings?.email ?? null,
      address: settings?.address ?? null,
      facebookUrl: settings?.facebookUrl ?? null,
      instagramUrl: settings?.instagramUrl ?? null,
      tiktokUrl: settings?.tiktokUrl ?? null,
      youtubeUrl: settings?.youtubeUrl ?? null,
      locale: {
        language: settings?.defaultLanguage ?? 'en',
        timezone: settings?.timezone ?? 'UTC',
        country: settings?.country ?? 'BD',
        currencyCode: settings?.currencyCode ?? 'BDT',
        currencySymbol: settings?.currencySymbol ?? '৳',
        currencyPosition: settings?.currencyPosition ?? 'before',
        numberFormat: settings?.numberFormat ?? 'south_asian',
        dateFormat: settings?.dateFormat ?? 'DD/MM/YYYY',
        timeFormat: settings?.timeFormat ?? '12h',
        weekStart: settings?.weekStart ?? 'saturday',
      },
    };
  }

  // =========================================================================
  // STORE SETTINGS — UPDATE
  // =========================================================================

  /**
   * Update branding, contact, and social link settings.
   */
  async updateStoreSettings(tenantId: string, dto: UpdateStoreSettingsDto) {
    // Update businessName on the Tenant model if provided
    if (dto.businessName) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { businessName: dto.businessName },
      });
    }

    // Build store settings update data (excluding businessName)
    const { businessName: _businessName, ...settingsData } = dto;

    const settings = await this.prisma.storeSettings.upsert({
      where: { tenantId },
      update: settingsData,
      create: {
        tenantId,
        ...settingsData,
      },
    });

    this.eventEmitter.emit('settings.updated', {
      tenantId,
      section: 'branding',
    });

    return settings;
  }

  /**
   * Update locale configuration.
   */
  async updateLocaleSettings(tenantId: string, dto: UpdateLocaleSettingsDto) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { tenantId },
      update: dto,
      create: {
        tenantId,
        ...dto,
      },
    });

    this.eventEmitter.emit('settings.updated', {
      tenantId,
      section: 'locale',
    });

    return settings;
  }

  /**
   * Update payment configuration (bKash, Nagad, SSLCommerz).
   */
  async updatePaymentSettings(tenantId: string, dto: UpdatePaymentSettingsDto) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { tenantId },
      update: dto,
      create: {
        tenantId,
        ...dto,
      },
    });

    this.eventEmitter.emit('settings.updated', {
      tenantId,
      section: 'payment',
    });

    return settings;
  }

  /**
   * Update courier configuration.
   */
  async updateCourierSettings(tenantId: string, dto: UpdateCourierSettingsDto) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { tenantId },
      update: dto,
      create: {
        tenantId,
        ...dto,
      },
    });

    this.eventEmitter.emit('settings.updated', {
      tenantId,
      section: 'courier',
    });

    return settings;
  }

  /**
   * Update operational settings (buffer days, session limits, SMS toggle).
   */
  async updateOperationalSettings(tenantId: string, dto: UpdateOperationalSettingsDto) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { tenantId },
      update: dto,
      create: {
        tenantId,
        ...dto,
      },
    });

    this.eventEmitter.emit('settings.updated', {
      tenantId,
      section: 'operational',
    });

    return settings;
  }

  // =========================================================================
  // CUSTOM DOMAIN
  // =========================================================================

  /**
   * Set a custom domain for the tenant.
   * Validates format and checks uniqueness.
   */
  async setCustomDomain(tenantId: string, domain: string) {
    // Normalize domain (lowercase, no trailing dots)
    const normalizedDomain = domain.toLowerCase().replace(/\.$/, '');

    // Check if domain is already used by another tenant
    const existing = await this.prisma.tenant.findUnique({
      where: { customDomain: normalizedDomain },
      select: { id: true },
    });

    if (existing && existing.id !== tenantId) {
      throw new BadRequestException(
        'This domain is already connected to another store',
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { customDomain: normalizedDomain },
    });

    this.eventEmitter.emit('settings.customDomainSet', {
      tenantId,
      domain: normalizedDomain,
    });

    return {
      domain: normalizedDomain,
      status: 'pending_verification',
      dnsInstructions: {
        aRecord: {
          type: 'A',
          host: '@',
          value: process.env.SERVER_IP || '0.0.0.0',
        },
        cnameRecord: {
          type: 'CNAME',
          host: '@',
          value: process.env.BASE_DOMAIN || 'closetrent.com',
        },
      },
    };
  }

  /**
   * Verify DNS configuration for the tenant's custom domain.
   */
  async verifyCustomDomain(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { customDomain: true },
    });

    if (!tenant?.customDomain) {
      throw new BadRequestException('No custom domain configured');
    }

    const domain = tenant.customDomain;
    const serverIp = process.env.SERVER_IP || '0.0.0.0';
    const baseDomain = process.env.BASE_DOMAIN || 'closetrent.com';

    let verified = false;
    let method = '';

    // Check A record
    try {
      const addresses = await dnsResolve4(domain);
      if (addresses.includes(serverIp)) {
        verified = true;
        method = 'A record';
      }
    } catch {
      // A record lookup failed — try CNAME
    }

    // Check CNAME record
    if (!verified) {
      try {
        const cnames = await dnsResolveCname(domain);
        if (cnames.some((cname) => cname.endsWith(baseDomain))) {
          verified = true;
          method = 'CNAME record';
        }
      } catch {
        // CNAME lookup also failed
      }
    }

    if (!verified) {
      throw new UnprocessableEntityException(
        'DNS not yet propagated. Please ensure your DNS records are configured correctly ' +
        'and try again later. DNS changes can take up to 48 hours to propagate.',
      );
    }

    this.logger.log(
      `Custom domain ${domain} verified for tenant ${tenantId} via ${method}`,
    );

    this.eventEmitter.emit('settings.customDomainVerified', {
      tenantId,
      domain,
      method,
    });

    return {
      domain,
      verified: true,
      sslStatus: 'provisioning',
    };
  }

  /**
   * Remove custom domain from tenant.
   */
  async removeCustomDomain(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { customDomain: true },
    });

    if (!tenant?.customDomain) {
      throw new BadRequestException('No custom domain configured');
    }

    const domain = tenant.customDomain;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { customDomain: null },
    });

    this.eventEmitter.emit('settings.customDomainRemoved', {
      tenantId,
      domain,
    });

    return { message: 'Custom domain removed' };
  }
}
