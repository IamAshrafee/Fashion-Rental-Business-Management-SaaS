import apiClient from '../api-client';
import type { ApiResponse } from '@closetrent/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuestProductCard {
  id: string;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string } | null;
  subcategory: { id: string; name: string; slug: string } | null;
  events: Array<{ id: string; name: string }>;
  rentalPrice: number | null;
  pricingMode: string | null;
  includedDays: number | null;
  depositAmount: number;
  isAvailable: boolean;
  totalBookings: number;
  defaultVariant: {
    id: string;
    mainColor: { id: string; name: string; hexCode: string | null } | null;
    featuredImage: { url: string; thumbnailUrl: string } | null;
  } | null;
  variantCount: number;
}

export interface GuestProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  isAvailable: boolean;
  purchasePrice: number | null;
  purchasePricePublic: boolean;
  itemCountry: string | null;
  itemCountryPublic: boolean;
  totalBookings: number;
  createdAt: string;
  // Nested relations
  category: { id: string; name: string; slug: string } | null;
  subcategory: { id: string; name: string; slug: string } | null;
  events: Array<{ id: string; name: string; slug: string }>;
  pricing: {
    mode: string;
    rentalPrice: number | null;
    includedDays: number | null;
    pricePerDay: number | null;
    minimumDays: number | null;
    retailPrice: number | null;
    calculatedPrice: number | null;
    priceOverride: number | null;
    extendedRentalRate: number | null;
    shippingMode: string | null;
    shippingFee: number | null;
  } | null;
  services: {
    depositAmount: number | null;
    cleaningFee: number | null;
    backupSizeEnabled: boolean;
    backupSizeFee: number | null;
    tryOnEnabled: boolean;
    tryOnFee: number | null;
    tryOnDurationHours: number | null;
    tryOnCreditToRental: boolean;
  } | null;
  productSize: {
    id: string;
    mode: string;
    freeSizeType: string | null;
    availableSizes: string[];
    sizeChartUrl: string | null;
    mainDisplaySize: string | null;
    measurements: Array<{
      id: string;
      label: string;
      value: string;
      unit: string;
      sequence: number;
    }>;
    parts: Array<{
      id: string;
      partName: string;
      sequence: number;
      measurements: Array<{
        id: string;
        label: string;
        value: string;
        unit: string;
        sequence: number;
      }>;
    }>;
  } | null;
  variants: Array<{
    id: string;
    variantName: string | null;
    sequence: number;
    mainColor: { id: string; name: string; hexCode: string | null };
    identicalColors: Array<{ id: string; name: string; hexCode: string | null }>;
    images: Array<{
      id: string;
      url: string;
      thumbnailUrl: string;
      isFeatured: boolean;
      sequence: number;
    }>;
  }>;
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
    sequence: number;
  }>;
  details: Array<{
    id: string;
    header: string;
    entries: Array<{ id: string; key: string; value: string; sequence: number }>;
  }>;
}

export interface GuestProductsQuery {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  event?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface GuestPaginatedProducts {
  data: GuestProductCard[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface FilterCounts {
  categories: Array<{ slug: string; name: string; count: number }>;
  events: Array<{ slug: string; name: string; count: number }>;
  priceRange: { min: number; max: number };
}

export interface GuestCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  subcategories: Array<{ id: string; name: string; slug: string }>;
}

export interface GuestEvent {
  id: string;
  name: string;
  slug: string;
}

export interface SearchResult {
  results: GuestProductCard[];
  total: number;
  query: string;
}

export interface SearchSuggestion {
  type: 'product' | 'category';
  text: string;
  slug: string;
}

export interface AvailabilityMonth {
  blockedDates: string[];
  [key: string]: unknown;
}

export interface DateRangeCheck {
  available: boolean;
  rentalDays: number;
  rentalPrice: number;
  extendedDays: number;
  extendedCost: number;
  totalRentalPrice: number;
  deposit: number;
  [key: string]: unknown;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/products
 * Public product listing with filters and pagination.
 */
export async function getGuestProducts(
  query?: GuestProductsQuery,
): Promise<GuestPaginatedProducts> {
  const { data } = await apiClient.get<GuestPaginatedProducts>('/products', {
    params: query,
  });
  return data;
}

/**
 * GET /api/v1/products/:slug
 * Public product detail by slug.
 */
export async function getProductBySlug(
  slug: string,
): Promise<GuestProductDetail> {
  const { data } = await apiClient.get<GuestProductDetail>(
    `/products/${encodeURIComponent(slug)}`,
  );
  return data;
}

/**
 * GET /api/v1/products/filters
 * Filter option counts for the current tenant.
 */
export async function getProductFilters(): Promise<FilterCounts> {
  const { data } = await apiClient.get<FilterCounts>('/products/filters');
  return data;
}

/**
 * GET /api/v1/products/search?q=...&page=...&limit=...
 * Full-text search with fuzzy fallback.
 */
export async function searchProducts(
  q: string,
  page = 1,
  limit = 20,
): Promise<SearchResult> {
  const { data } = await apiClient.get<SearchResult>('/products/search', {
    params: { q, page, limit },
  });
  return data;
}

/**
 * GET /api/v1/products/search/suggest?q=...
 * Auto-suggest as user types.
 */
export async function suggestProducts(
  q: string,
): Promise<{ suggestions: SearchSuggestion[] }> {
  const { data } = await apiClient.get<{ suggestions: SearchSuggestion[] }>(
    '/products/search/suggest',
    { params: { q } },
  );
  return data;
}

/**
 * GET /api/v1/categories
 * Public category listing for a tenant.
 */
export async function getGuestCategories(): Promise<GuestCategory[]> {
  const { data } = await apiClient.get<GuestCategory[]>('/categories');
  return data;
}

/**
 * GET /api/v1/events
 * Public event listing for a tenant.
 */
export async function getGuestEvents(): Promise<GuestEvent[]> {
  const { data } = await apiClient.get<GuestEvent[]>('/events');
  return data;
}

/**
 * GET /api/v1/products/:productId/availability?month=2026-04
 * Returns blocked dates for a product in a given month.
 */
export async function checkProductAvailability(
  productId: string,
  month: string,
): Promise<AvailabilityMonth> {
  const { data } = await apiClient.get<AvailabilityMonth>(
    `/products/${productId}/availability`,
    { params: { month } },
  );
  return data;
}

/**
 * POST /api/v1/products/:productId/check-availability
 * Checks a specific date range and returns pricing breakdown.
 */
export async function checkDateRange(
  productId: string,
  startDate: string,
  endDate: string,
): Promise<DateRangeCheck> {
  const { data } = await apiClient.post<DateRangeCheck>(
    `/products/${productId}/check-availability`,
    { startDate, endDate },
  );
  return data;
}
