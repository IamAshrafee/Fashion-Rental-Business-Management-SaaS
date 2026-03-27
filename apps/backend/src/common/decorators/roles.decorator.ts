import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@closetrent/types';

export const ROLES_KEY = 'roles';

/**
 * Set required roles for an endpoint.
 * Used with RolesGuard to enforce role-based access.
 * Usage: @Roles('owner', 'manager')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
