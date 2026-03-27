import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser, UserRole } from '@closetrent/types';

/**
 * Role-Based Access Control Guard.
 * Checks if the authenticated user has one of the required roles
 * specified by the @Roles() decorator.
 *
 * Role hierarchy (higher can do everything lower can):
 *   saas_admin > owner > manager > staff
 *
 * If no @Roles() decorator is present, access is granted (auth-only check).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required — any authenticated user can access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // saas_admin has access to everything
    if (user.role === 'saas_admin') {
      return true;
    }

    // Check if user's role is in the required roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
