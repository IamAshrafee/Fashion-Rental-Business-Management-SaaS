import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, Permission } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '@closetrent/types';

/**
 * Permission matrix from the staff-access spec.
 * Maps each permission to the roles that have it.
 */
const PERMISSION_MATRIX: Record<Permission, string[]> = {
  manage_products: ['owner', 'manager', 'staff'],
  manage_bookings: ['owner', 'manager', 'staff'],
  view_customers: ['owner', 'manager', 'staff'],
  manage_customers: ['owner', 'manager'],
  view_analytics: ['owner', 'manager'],
  manage_settings: ['owner'],
  manage_staff: ['owner'],
  manage_billing: ['owner'],
};

/**
 * Permission-Based Access Control Guard.
 * Uses the permission matrix from docs/features/staff-access.md
 * to determine if the current user's role has the required permission.
 *
 * Usage: @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
 *        @RequirePermission('manage_settings')
 *
 * saas_admin always has access to everything.
 * If no @RequirePermission() decorator is present, access is granted.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for @Public() endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required — any authenticated user can access
    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    // Check if user's role has ALL required permissions
    const hasPermission = requiredPermissions.every((permission) => {
      const allowedRoles = PERMISSION_MATRIX[permission];
      return allowedRoles && allowedRoles.includes(user.role);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
