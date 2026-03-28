import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SubscriptionService } from '../../modules/tenant/subscription.service';

/**
 * Subscription Guard.
 * Checks that the current tenant's subscription is active.
 * Blocks access if subscription is expired or cancelled.
 *
 * Skips check:
 * - If endpoint is @Public()
 * - If no tenant is on the request (non-tenant-scoped routes)
 *
 * Grace period (ADR-21): allows access during 7-day grace period
 * but the response header will include X-Subscription-Warning.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip for @Public() endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    // No tenant = non-tenant-scoped route (e.g., admin)
    if (!tenant) return true;

    // saas_admin bypasses subscription checks
    const user = request.user;
    if (user?.role === 'saas_admin') return true;

    const status = await this.subscriptionService.getSubscriptionStatus(tenant.id);

    if (status.isExpired) {
      throw new ForbiddenException(
        'Your subscription has expired. Please renew to continue using the service.',
      );
    }

    // Add warning header during grace period
    if (status.isInGracePeriod) {
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-Subscription-Warning', 'grace_period');
      this.logger.warn(
        `Tenant ${tenant.id} is in subscription grace period`,
      );
    }

    return true;
  }
}
