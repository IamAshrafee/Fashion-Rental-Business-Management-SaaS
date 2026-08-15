import { UserRole, LoginEventType, DeviceType } from './index';

// =========================================================================
// STORE SETTINGS
// =========================================================================

export interface UpdateStoreSettingsDto {
  businessName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tagline?: string;
  about?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
}

export interface UpdateLocaleSettingsDto {
  defaultLanguage?: string;
  timezone?: string;
  country?: string;
  currencyCode?: string;
  currencySymbol?: string;
  currencyPosition?: 'before' | 'after';
  numberFormat?: 'south_asian' | 'international';
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat?: '12h' | '24h';
  weekStart?: 'saturday' | 'sunday' | 'monday';
}

export interface UpdatePaymentSettingsDto {
  bkashNumber?: string;
  nagadNumber?: string;
  sslcommerzStoreId?: string;
  sslcommerzStorePass?: string;
  clearSslcommerzCredentials?: boolean;
  sslcommerzSandbox?: boolean;
}

export interface UpdateDeliverySettingsDto {
  pickupAddress?: string;
  pickupCity?: string;
  pickupLeadDays?: number;
  pickupLeadDaysConfig?: { districtLeadDays: Record<string, number>; defaultLeadDays: number };
}

export type CourierProviderName = 'pathao' | 'steadfast' | 'manual';

export interface CourierConnectionView {
  id: string;
  provider: CourierProviderName;
  isEnabled: boolean;
  isDefault: boolean;
  config: { storeId?: number; sandbox?: boolean };
  hasCredentials: boolean;
  webhookToken: string;
  healthStatus: 'not_tested' | 'configured' | 'healthy' | 'unhealthy';
  lastHealthCheckAt: string | null;
  lastHealthError: string | null;
  updatedAt: string;
}

export interface UpsertCourierConnectionDto {
  isEnabled?: boolean;
  isDefault?: boolean;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  storeId?: number;
  sandbox?: boolean;
  apiKey?: string;
  secretKey?: string;
}

export interface UpdateOperationalSettingsDto {
  maxConcurrentSessions?: number;
  bufferDays?: number;
  smsEnabled?: boolean;
}

export interface SetCustomDomainDto {
  domain: string;
}

// Full combined settings view
export interface StoreSettings {
  id: string;
  tenantId: string;

  // General & Contact
  businessName: string;
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;

  // Branding
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;

  // Social
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;

  // Locale
  defaultLanguage: string;
  timezone: string;
  country: string;
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  numberFormat: 'south_asian' | 'international';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  weekStart: 'saturday' | 'sunday' | 'monday';

  // Payment
  bkashNumber: string | null;
  nagadNumber: string | null;
  sslcommerzStoreId: string | null;
  sslcommerzConfigured: boolean;
  sslcommerzSandbox: boolean;

  // Delivery operations
  pickupAddress: string | null;
  pickupCity: string | null;

  // Pickup scheduling
  pickupLeadDays?: number;
  pickupLeadDaysConfig?: { districtLeadDays: Record<string, number>; defaultLeadDays: number };

  // Operational
  maxConcurrentSessions: number;
  bufferDays: number;
  smsEnabled: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanView {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceAnnual: number | null;
  maxProducts: number | null;
  maxOrders: number | null;
  maxStaff: number;
  customDomain: boolean;
  smsEnabled: boolean;
  analyticsFull: boolean;
  removeBranding: boolean;
}

export interface SubscriptionView {
  id: string;
  planId: string;
  plan: SubscriptionPlanView;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  computed: {
    isActive: boolean;
    isInTrial: boolean;
    isInGracePeriod: boolean;
    isExpired: boolean;
    daysRemaining: number;
    status: string;
  };
}

export interface PlanResourceUsage {
  allowed: boolean;
  current: number;
  limit: number | null;
}

export interface ResourceUsageView {
  products: PlanResourceUsage;
  staff: PlanResourceUsage;
  orders: PlanResourceUsage;
}

export interface SubscriptionPaymentView {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNo: string;
    status: string;
  } | null;
}

// =========================================================================
// STAFF MANAGEMENT
// =========================================================================

export interface StaffQueryDto {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InviteStaffDto {
  fullName: string;
  email?: string;
  phone?: string;
  role: 'manager' | 'staff';
  permissions?: StaffPermission[];
}

export interface UpdateStaffDto {
  role?: 'manager' | 'staff';
  isActive?: boolean;
  permissions?: StaffPermission[];
}

export type TenantPermission =
  | 'manage_products'
  | 'manage_inventory'
  | 'manage_bookings'
  | 'manage_fulfillment'
  | 'view_customers'
  | 'manage_customers'
  | 'view_analytics'
  | 'manage_finance'
  | 'manage_settings'
  | 'manage_staff'
  | 'manage_billing';

export type StaffPermission = Exclude<
  TenantPermission,
  'manage_settings' | 'manage_staff' | 'manage_billing'
>;

export interface Staff {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  permissions: StaffPermission[];
  lastLoginAt?: string;
  joinedAt: string;
}

export interface StaffInvitation {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: 'manager' | 'staff';
  permissions: StaffPermission[];
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreatedStaffInvitation extends StaffInvitation {
  token: string;
}

// =========================================================================
// SESSION MANAGEMENT
// =========================================================================

export interface Session {
  id: string;
  userId: string;
  userName?: string;
  deviceType: DeviceType;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
  lastActiveAt: string;
  isCurrent: boolean;
  isImpersonation?: boolean;
  impersonatorName?: string;
}

export interface LoginEvent {
  id: string;
  userId: string;
  eventType: LoginEventType;
  deviceType: DeviceType;
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
  createdAt: string;
}
