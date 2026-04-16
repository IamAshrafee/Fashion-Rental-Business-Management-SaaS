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
export type SizeSchemaStatus = 'draft' | 'active' | 'deprecated';

// --- Sizing Types ---

export interface SizeDimensionDef {
  code: string;
  label: string;
  type: 'enum' | 'number' | 'text';
  required: boolean;
  values?: string[];
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}

export interface SizeSchemaUIDef {
  selectorType: 'grid' | 'dropdown' | 'composite' | 'component';
  displayTemplate: string;
  dimensionOrder: string[];
  components?: Record<string, { schemaCode: string }>;
}

export interface SizeSchemaDefinition {
  dimensions: SizeDimensionDef[];
  ui: SizeSchemaUIDef;
  normalization: {
    normalizedKeyTemplate: string;
  };
}

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
  /** Set to true when token was issued via admin impersonation */
  isImpersonation?: boolean;
  /** The admin user ID that initiated impersonation */
  impersonatorId?: string;
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
  description: string | null;
  features: string[] | null;
  badge: string | null;
  priceMonthly: number;       // Paisa (ADR-04)
  priceAnnual: number | null; // Paisa (ADR-04)
  trialDays: number;
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
  expectedMrr: number;
  actualMrr: number;
  gmv: number;
  churnRate: number;
  totalProducts: number;
  totalOrders: number;
}

export type BillingPaymentStatus = 'paid' | 'overdue' | 'never_paid';

export interface AdminTenantSummary {
  id: string;
  businessName: string;
  subdomain: string;
  plan: string;
  planSlug: string | null;
  status: TenantStatus;
  paymentStatus: BillingPaymentStatus;
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
  referralSource: string | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    computedStatus: string; // active, trial, grace_period, expired
    daysRemaining: number;
  } | null;
  owner: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
  storeSettings: any;
  _count: {
    products: number;
    bookings: number;
    customers: number;
  };
}

// --- Platform Billing (SaaS-level) ---

export type PaymentMethod_Platform = 'bkash' | 'nagad' | 'bank_transfer' | 'cash' | 'other';
export type InvoiceStatus = 'unpaid' | 'paid' | 'void';

export interface SubscriptionPayment {
  id: string;
  tenantId: string;
  amount: number;           // Paisa
  method: string;
  reference: string | null;
  notes: string | null;
  periodStart: string;
  periodEnd: string;
  recordedBy: string;
  createdAt: string;
  recorder?: { fullName: string };
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;             // Paisa
  amount: number;           // Paisa
}

export interface PlatformInvoice {
  id: string;
  tenantId: string;
  paymentId: string | null;
  invoiceNo: string;
  amount: number;           // Paisa
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  lineItems: InvoiceLineItem[];
  notes: string | null;
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  linkedPlanId: string | null;
  linkedPlan?: SubscriptionPlan | null;
  trialDays: number | null;
  discountPct: number | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  _count?: { tenants: number };
}

export interface SubscriptionHistoryEntry {
  id: string;
  tenantId: string;
  oldPlanId: string | null;
  newPlanId: string;
  action: string;
  billingCycle: string | null;
  reason: string | null;
  performedBy: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  oldPlan?: { name: string; slug: string } | null;
  newPlan?: { name: string; slug: string };
  actor?: { fullName: string };
}

// --- Analytics ---
export * from './analytics';
export * from './customer';
export * from './settings';
export * from './events';
