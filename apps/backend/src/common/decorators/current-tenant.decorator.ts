import { createParamDecorator, ExecutionContext, NotFoundException } from '@nestjs/common';
import { TenantContext } from '@closetrent/types';

interface CurrentTenantOptions {
  required?: boolean;
}

/**
 * Extract the current tenant from the request.
 * TenantMiddleware must attach `req.tenant` before this works.
 * Throws NotFoundException if tenant is required (default: true) but not found.
 * Usage: @CurrentTenant() tenant: TenantContext
 */
export const CurrentTenant = createParamDecorator(
  (data: CurrentTenantOptions | undefined, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (data?.required !== false && !tenant) {
      throw new NotFoundException('Store not found or no tenant context provided');
    }

    return tenant;
  },
);
