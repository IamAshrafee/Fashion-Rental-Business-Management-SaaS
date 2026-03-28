// ============================================
// ClosetRent — Shared TypeScript Types
// Used by both frontend and backend
// ============================================
// These mirror Prisma enums as string unions so the
// frontend can use them without importing @prisma/client.
// ============================================

// --- Enums (mirrors Prisma schema) ---

export type TenantStatus = 'active' | 'suspended' | 'cancelled';
export type UserRole = 'saas_admin' | 'owner' | 'manager' | 'staff';
export type TenantRole = 'owner' | 'manager' | 'staff';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type SizeMode = 'standard' | 'measurement' | 'multi_part' | 'free';
export type FreeSizeType = 'free_size' | 'adjustable' | 'no_size';
export type PricingMode = 'one_time' | 'per_day' | 'percentage';
export type LateFeeType = 'fixed' | 'percentage';
export type ShippingMode = 'free' | 'flat' | 'area_based';
export type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'sslcommerz';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type TransactionStatus = 'pending' | 'verified' | 'failed' | 'refunded';
export type CancelledBy = 'customer' | 'owner';
export type BlockType = 'booking' | 'pending' | 'manual';
export type DepositStatus =
  | 'pending'
  | 'collected'
  | 'held'
  | 'refunded'
  | 'partially_refunded'
  | 'forfeited';
export type DamageLevel =
  | 'none'
  | 'minor'
  | 'moderate'
  | 'severe'
  | 'destroyed'
  | 'lost';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'shipped'
  | 'delivered'
  | 'overdue'
  | 'returned'
  | 'inspected'
  | 'completed';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trial';
export type BillingCycle = 'monthly' | 'annual';
export type DeviceType = 'desktop' | 'mobile' | 'tablet';
export type LoginEventType =
  | 'login_success'
  | 'login_failed'
  | 'session_revoked'
  | 'logout'
  | 'token_refreshed';

// --- Tenant Context ---

export interface TenantContext {
  id: string;
  subdomain: string;
  customDomain: string | null;
  status: TenantStatus;
}

// --- Auth ---

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  tenantId: string | null;
  sessionId: string;
}

export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

// --- API Response ---

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// --- Common Query Params ---

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// --- Admin & Platform Models ---

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceAnnual: number | null;
  maxProducts: number | null;
  maxStaff: number;
  customDomain: boolean;
  smsEnabled: boolean;
  analyticsFull: boolean;
  removeBranding: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStats {
  tenants: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  mrr: number;
  gmv: number;
  churnRate: number;
  totalProducts: number;
  totalOrders: number;
}

export interface AdminTenantSummary {
  id: string;
  businessName: string;
  subdomain: string;
  plan: string;
  status: TenantStatus;
  productCount: number;
  orderCount: number;
  totalRevenue: number;
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
}

export interface AdminTenantDetails {
  id: string;
  businessName: string;
  subdomain: string;
  customDomain: string | null;
  status: TenantStatus;
  plan: SubscriptionPlan | null;
  owner: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
  storeSettings: any; // We can type this later if needed
  _count: {
    products: number;
    bookings: number;
    customers: number;
  };
}

// --- Analytics ---
export * from './analytics';
export * from './customer';
export * from './settings';
export * from './events';
