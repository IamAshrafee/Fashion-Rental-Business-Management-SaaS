import {
  Injectable,
  NestMiddleware,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../../modules/tenant/tenant.service';
import { TenantContext } from '@closetrent/types';

// Extend Express Request to include tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Routes that bypass tenant resolution entirely.
 * These are global/admin routes that don't belong to a tenant.
 */
const EXCLUDED_PATHS = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/check-subdomain',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/health',
];

/**
 * Tenant Resolution Middleware.
 * Resolves the tenant from either:
 *   1. Custom domain (if not *.closetrent.com)
 *   2. Subdomain (e.g., storename.closetrent.com)
 *   3. X-Tenant-ID header (for API/development)
 *
 * Attaches `req.tenant` (TenantContext) to every request.
 * Admin portal routes are excluded.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private readonly baseDomain: string;
  private readonly adminSubdomain: string;

  constructor(
    private readonly tenantService: TenantService,
    private readonly configService: ConfigService,
  ) {
    this.baseDomain = this.configService.get<string>('baseDomain', 'localhost:3000');
    this.adminSubdomain = this.configService.get<string>('adminSubdomain', 'admin');
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // Skip excluded paths (auth registration, health, etc.)
    const path = req.baseUrl + req.path;
    if (EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded))) {
      return next();
    }

    // Skip admin portal routes
    const host = req.hostname || req.headers.host || '';
    if (this.isAdminHost(host)) {
      return next();
    }

    // Try to resolve tenant
    let tenant: TenantContext | null = null;

    // 1. X-Tenant-ID header (development / API clients)
    const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
    if (tenantIdHeader) {
      try {
        const tenantData = await this.tenantService.findById(tenantIdHeader);
        tenant = {
          id: tenantData.id,
          subdomain: tenantData.subdomain,
          customDomain: tenantData.customDomain,
          status: tenantData.status,
        };
      } catch {
        throw new NotFoundException('Store not found');
      }
    }

    // 2. Custom domain
    if (!tenant && !this.isBaseDomainHost(host)) {
      tenant = await this.tenantService.resolveByCustomDomain(host);
    }

    // 3. Subdomain
    if (!tenant) {
      const subdomain = this.extractSubdomain(host);
      if (subdomain && subdomain !== this.adminSubdomain) {
        tenant = await this.tenantService.resolveBySubdomain(subdomain);
      }
    }

    // Tenant found — validate status and attach to request
    if (tenant) {
      this.tenantService.validateTenantStatus(tenant);
      req.tenant = tenant;
      this.logger.debug(`Resolved tenant: ${tenant.subdomain} (${tenant.id})`);
    }

    // If no tenant found and it's not an excluded path, that's okay for
    // some routes (like /auth/refresh which uses JWT tenantId).
    // Individual handlers/guards will enforce tenant presence if needed.

    next();
  }

  /**
   * Check if the host is the admin subdomain.
   */
  private isAdminHost(host: string): boolean {
    const hostWithoutPort = host.split(':')[0];
    return hostWithoutPort === `${this.adminSubdomain}.${this.baseDomain.split(':')[0]}`;
  }

  /**
   * Check if the host matches the base domain (with or without subdomain).
   */
  private isBaseDomainHost(host: string): boolean {
    const hostWithoutPort = host.split(':')[0];
    const baseDomainWithoutPort = this.baseDomain.split(':')[0];
    return hostWithoutPort.endsWith(baseDomainWithoutPort) || hostWithoutPort === baseDomainWithoutPort;
  }

  /**
   * Extract subdomain from host.
   * e.g., "storename.closetrent.com" → "storename"
   * e.g., "storename.localhost" → "storename"
   */
  private extractSubdomain(host: string): string | null {
    const hostWithoutPort = host.split(':')[0];
    const baseDomainWithoutPort = this.baseDomain.split(':')[0];

    // If host ends with base domain, extract what comes before it
    if (hostWithoutPort.endsWith(`.${baseDomainWithoutPort}`)) {
      const subdomain = hostWithoutPort.slice(0, -(baseDomainWithoutPort.length + 1));
      if (subdomain && !subdomain.includes('.')) {
        return subdomain;
      }
    }

    // Development: handle "subdomain.localhost"
    if (baseDomainWithoutPort === 'localhost' && hostWithoutPort.endsWith('.localhost')) {
      const subdomain = hostWithoutPort.slice(0, -'.localhost'.length);
      if (subdomain && !subdomain.includes('.')) {
        return subdomain;
      }
    }

    return null;
  }
}
