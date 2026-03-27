import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '@closetrent/types';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    // Reserved subdomains that cannot be used
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
}
