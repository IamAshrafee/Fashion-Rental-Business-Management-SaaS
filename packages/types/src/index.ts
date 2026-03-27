// ============================================
// ClosetRent — Shared TypeScript Types
// Used by both frontend and backend
// ============================================

// --- Tenant ---

export type TenantStatus = 'active' | 'suspended' | 'cancelled';

export interface TenantContext {
  id: string;
  subdomain: string;
  customDomain: string | null;
  status: TenantStatus;
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

// --- User ---

export type UserRole = 'super_admin' | 'owner' | 'manager' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}

// --- Booking Status ---

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'inspected'
  | 'completed'
  | 'cancelled'
  | 'overdue';

// --- Common ---

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
