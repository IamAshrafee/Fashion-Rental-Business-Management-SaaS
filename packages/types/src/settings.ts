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
  businessName?: string;
  tagline?: string;
  about?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  
  // Branding
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  
  // Social
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  
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
  bkashNumber?: string;
  nagadNumber?: string;
  sslcommerzStoreId?: string;
  sslcommerzStorePass?: string;
  sslcommerzSandbox: boolean;
  
  // Delivery operations
  pickupAddress?: string;
  pickupCity?: string;

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
  role: UserRole;
  password?: string;
}

export interface UpdateStaffDto {
  role?: UserRole;
  isActive?: boolean;
}

export interface Staff {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// =========================================================================
// SESSION MANAGEMENT
// =========================================================================

export interface Session {
  id: string;
  userId: string;
  deviceType: DeviceType;
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
  lastActiveAt: string;
  isCurrent: boolean;
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
