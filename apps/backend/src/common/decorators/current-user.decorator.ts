import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@closetrent/types';

/**
 * Extract the current authenticated user from the request.
 * JwtAuthGuard must attach `req.user` before this works.
 * Usage: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
