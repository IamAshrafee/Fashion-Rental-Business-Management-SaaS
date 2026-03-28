import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Permission types matching the staff-access spec permission matrix.
 * Used with PermissionsGuard to enforce feature-level access control.
 *
 * Permission matrix:
 *   manage_products   → owner, manager, staff (staff = view only, enforced at endpoint level)
 *   manage_bookings   → owner, manager, staff
 *   view_customers    → owner, manager, staff
 *   manage_customers  → owner, manager
 *   view_analytics    → owner, manager
 *   manage_settings   → owner
 *   manage_staff      → owner
 *   manage_billing    → owner
 */
export type Permission =
  | 'manage_products'
  | 'manage_bookings'
  | 'view_customers'
  | 'manage_customers'
  | 'view_analytics'
  | 'manage_settings'
  | 'manage_staff'
  | 'manage_billing';

/**
 * Set required permissions for an endpoint.
 * Used with PermissionsGuard to enforce the permission matrix.
 * Usage: @RequirePermission('manage_settings')
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
