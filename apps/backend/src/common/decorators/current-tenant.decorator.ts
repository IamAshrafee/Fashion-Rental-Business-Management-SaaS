import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '@closetrent/types';

/**
 * Extract the current tenant from the request.
 * TenantMiddleware must attach `req.tenant` before this works.
 * Usage: @CurrentTenant() tenant: TenantContext
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
