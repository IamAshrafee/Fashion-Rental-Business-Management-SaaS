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

export interface UpdateCourierSettingsDto {
  defaultCourier?: string;
  courierApiKey?: string;
  courierSecretKey?: string;
  pickupAddress?: string;
  pathaoClientId?: string;
  pathaoClientSecret?: string;
  pathaoUsername?: string;
  pathaoPassword?: string;
  pathaoStoreId?: number;
  pathaoSandbox?: boolean;
  pickupLeadDays?: number;
  pickupLeadDaysConfig?: Record<string, number>;
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
  
  // Courier
  defaultCourier?: string;
  courierApiKey?: string;
  courierSecretKey?: string;
  pickupAddress?: string;
  pathaoClientId?: string;
  pathaoClientSecret?: string;
  pathaoUsername?: string;
  pathaoPassword?: string;
  pathaoStoreId?: number;
  pathaoSandbox?: boolean;

  // Pickup scheduling
  pickupLeadDays?: number;
  pickupLeadDaysConfig?: Record<string, number>;
  
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
