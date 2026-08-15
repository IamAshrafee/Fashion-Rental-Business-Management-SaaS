import type { TenantPermission } from '@closetrent/types';
import type { AuthUserInfo } from '@/types';

const DEFAULT_PERMISSIONS: Record<string, TenantPermission[]> = {
  owner: [
    'manage_products',
    'manage_inventory',
    'manage_bookings',
    'manage_fulfillment',
    'view_customers',
    'manage_customers',
    'view_analytics',
    'manage_finance',
    'manage_settings',
    'manage_staff',
    'manage_billing',
  ],
  manager: [
    'manage_products',
    'manage_inventory',
    'manage_bookings',
    'manage_fulfillment',
    'view_customers',
    'manage_customers',
    'view_analytics',
    'manage_finance',
  ],
  staff: [
    'manage_products',
    'manage_inventory',
    'manage_bookings',
    'manage_fulfillment',
    'view_customers',
  ],
};

export function hasTenantPermission(
  user: AuthUserInfo | null | undefined,
  permission: TenantPermission,
): boolean {
  if (!user) return false;
  if (user.role === 'saas_admin') return true;
  if (user.permissions.length > 0) return user.permissions.includes(permission);
  return DEFAULT_PERMISSIONS[user.role]?.includes(permission) ?? false;
}
