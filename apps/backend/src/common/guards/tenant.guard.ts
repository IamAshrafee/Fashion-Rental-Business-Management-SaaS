import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';

/**
 * Tenant Resolution Guard (stub).
 * Will be fully implemented in P03 (Auth & Tenant System).
 * Resolves tenant from subdomain/header and attaches to request.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  canActivate(_context: ExecutionContext): boolean {
    // TODO: P03 will implement tenant resolution from subdomain/header
    this.logger.warn('TenantGuard is a stub — allowing all requests');
    return true;
  }
}
