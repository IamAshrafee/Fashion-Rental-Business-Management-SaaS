import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '@closetrent/types';

/**
 * Tenant Guard.
 * Ensures the authenticated user belongs to the current tenant.
 * Compares JWT's tenantId with the tenant resolved by TenantMiddleware.
 * Returns 403 if there's a mismatch.
 *
 * Skips check:
 * - If endpoint is @Public()
 * - If no tenant is on the request (non-tenant-scoped routes like admin)
 * - If user is saas_admin (can access any tenant)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    const tenant = request.tenant;

    // No tenant on request — might be admin route or pre-tenant route
    if (!tenant) return true;

    // No user — JwtAuthGuard should have caught this, but be safe
    if (!user) return true;

    // SaaS admins can access any tenant
    if (user.role === 'saas_admin') return true;

    // Ensure user's tenantId matches the resolved tenant
    if (user.tenantId && user.tenantId !== tenant.id) {
      throw new ForbiddenException(
        'You do not have access to this store',
      );
    }

    return true;
  }
}
