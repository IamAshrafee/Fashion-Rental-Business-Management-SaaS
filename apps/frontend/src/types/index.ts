/**
 * Frontend-specific types for ClosetRent.
 *
 * Types shared with backend live in @closetrent/types.
 * These are UI-only / layout-only types.
 */

// ----------------------------------------------------------------
// Tenant Locale (from StoreSettings, used for formatting)
// ----------------------------------------------------------------

export interface TenantLocale {
  country: string;
  timezone: string;
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
  };
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  numberFormat: 'south_asian' | 'international';
  timeFormat: '12h' | '24h';
  weekStart: string;
}

// ----------------------------------------------------------------
// Tenant Public Info (returned from server for branding)
// ----------------------------------------------------------------

export interface TenantPublicInfo {
  id: string;
  businessName: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  bkashNumber: string | null;
  nagadNumber: string | null;
  locale: TenantLocale;
}

// ----------------------------------------------------------------
// Auth (frontend-specific shapes)
// ----------------------------------------------------------------

export interface AuthState {
  user: AuthUserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tenantId: string | null;
}

export interface AuthUserInfo {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  tenantId: string | null;
  /** The tenant's subdomain — used for post-login redirect to the correct store URL */
  subdomain?: string | null;
  suspendedTenants?: Array<{
    id: string;
    businessName: string;
    subdomain: string;
    status: string;
    statusReason: string | null;
  }>;
}

export interface LoginCredentials {
  emailOrPhone: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterPayload {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  businessName: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

// ----------------------------------------------------------------
// Navigation
// ----------------------------------------------------------------

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavItem[];
  disabled?: boolean;
}

// ----------------------------------------------------------------
// Data Table
// ----------------------------------------------------------------

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

// ----------------------------------------------------------------
// Status Config (for StatusBadge)
// ----------------------------------------------------------------

export interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}
