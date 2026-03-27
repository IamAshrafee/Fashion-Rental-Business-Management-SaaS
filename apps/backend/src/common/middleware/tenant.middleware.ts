import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Tenant Resolution Middleware (stub).
 * Will be fully implemented in P03 (Auth & Tenant System).
 * Resolves tenant from subdomain or X-Tenant-ID header.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    // TODO: P03 will implement tenant resolution from:
    // 1. Subdomain (e.g., storename.closetrent.com)
    // 2. X-Tenant-ID header (for API calls)
    // 3. Custom domain lookup
    this.logger.debug('TenantMiddleware is a stub — no tenant resolution');
    next();
  }
}
