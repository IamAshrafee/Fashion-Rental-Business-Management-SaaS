import apiClient from '../api-client';
import type { ApiResponse, PaginatedResponse, SizeSchemaDefinition } from '@closetrent/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: { id: string; name: string; slug: string }[];
}

export interface Event {
  id: string;
  name: string;
  slug: string;
}

export interface OwnerEvent {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export interface Color {
  id: string;
  name: string;
  hexCode: string | null;
}

export interface OwnerSubcategory {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
}

export interface OwnerCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  subcategories: OwnerSubcategory[];
  _count: { products: number };
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  rentalPrice: number;
  headlineLabel: string | null;
  pricingMode: string | null;
  totalBookings: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  productType: { id: string; name: string; slug: string } | null;
  thumbnailUrl: string | null;
  variantCount: number;
  skuCount: number;
  inventory: {
    onHand: number;
    physicalItems: number;
    hasStock: boolean;
  };
  readiness: {
    ready: boolean;
    blockers: ProductReadinessBlocker[];
  };
  onboarding: {
    currentSection: ProductOnboardingSection;
    completedSections: ProductOnboardingSection[];
    revision: number;
    updatedAt: string;
  } | null;
  deletedBy: { id: string; fullName: string } | null;
  _count: { bookingItems: number };
  deletedAt?: string | null;
}

export type ProductReadinessCode =
  | 'CATEGORY'
  | 'PRODUCT_TYPE'
  | 'SIZE_SCHEMA'
  | 'VARIANT'
  | 'RENTABLE_SKU'
  | 'VARIANT_MEDIA'
  | 'ACTIVE_PRICING'
  | 'COMPOSITION';

export type ProductReadinessSection =
  | 'basic'
  | 'sizing'
  | 'variants'
  | 'pricing'
  | 'composition';

export interface ProductReadinessBlocker {
  code: ProductReadinessCode;
  section: ProductReadinessSection;
  message: string;
  field?: string;
  entityId?: string;
}

export interface ProductReadiness {
  ready: boolean;
  blockers: ProductReadinessBlocker[];
}

export interface PricingProfileData {
  profileId: string;
  policyVersionId: string;
  currency: string;
  ratePlanType: 'PER_DAY' | 'FLAT_PERIOD' | 'TIERED_DAILY' | 'WEEKLY_MONTHLY' | 'PERCENT_RETAIL';
  ratePlanConfig: Record<string, unknown>;
  components: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
    refundable: boolean;
    visibility: string;
    chargeTiming: string;
  }>;
  lateFeePolicy: Record<string, unknown> | null;
  shippingMode: 'free' | 'flat';
  shippingFee: number;
}

export interface ProductTypeData {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  defaultSizeSchema?: SizeSchemaData | null;
  _count?: { products: number };
}

export interface SizeSchemaData {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  schemaType: string;
  status: 'draft' | 'active' | 'deprecated';
  definition: SizeSchemaDefinition | Record<string, unknown>;
  instances?: SizeInstanceData[];
  sizeCharts?: SizeChartData[];
  _count?: { instances: number; productTypes: number };
}

export interface SizeInstanceData {
  id: string;
  normalizedKey: string;
  displayLabel: string;
  payload: Record<string, unknown>;
  sortOrder: number;
}

export interface SizeChartData {
  id: string;
  title: string;
  chartMeta: Record<string, unknown>;
  rows: Array<{
    id: string;
    sizeLabel: string;
    measurements: Record<string, unknown>;
    sortOrder: number;
  }>;
}

export interface CreateSizeInstanceInput {
  normalizedKey: string;
  displayLabel: string;
  payload?: Record<string, unknown>;
  sortOrder?: number;
}

export interface CreateSizeChartRowInput {
  sizeLabel: string;
  measurements: Record<string, unknown>;
  sortOrder?: number;
}

export interface SizingPayload {
  schema: {
    id: string;
    code: string;
    name: string;
    schemaType: string;
    definition: SizeSchemaDefinition | Record<string, unknown>;
  };
  instances: SizeInstanceData[];
  sizeCharts: SizeChartData[];
}

export interface ProductVariantData {
  id: string;
  onboardingKey: string | null;
  variantName: string | null;
  mainColorId: string;
  sequence: number;
  mainColor: { id: string; name: string; hexCode: string | null };
  identicalColors: Array<{ color: { id: string; name: string; hexCode: string | null } }>;
  sizes: Array<{
    id: string;
    sizeInstanceId: string;
    inventoryVersion: number;
    sizeInstance: SizeInstanceData;
    _count?: { stockUnits: number };
  }>;
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    isFeatured: boolean;
    sequence: number;
    originalName: string | null;
  }>;
}

export type ProductOnboardingSection =
  | 'BASICS'
  | 'SKUS'
  | 'CONTENT'
  | 'PRICING'
  | 'REVIEW';

export interface ProductOnboarding {
  id: string;
  productId: string;
  currentSection: ProductOnboardingSection;
  completedSections: ProductOnboardingSection[];
  nextSection: ProductOnboardingSection;
  revision: number;
  lastSavedAt: string;
  lastSavedBy: { id: string; fullName: string };
  commandCount: number;
  product: ProductDetail;
  readiness: ProductReadiness;
}

export interface ProductFaqData {
  id: string;
  question: string;
  answer: string;
  sequence: number;
}

export interface ProductDetailHeaderData {
  id: string;
  headerName: string;
  sequence: number;
  entries: Array<{ id: string; key: string; value: string; sequence: number }>;
}

/**
 * Full product detail — matches the Prisma response from
 * `GET /owner/products/:id` with `fullProductIncludes()`.
 */
export interface ProductDetail {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  subcategoryId: string | null;
  status: 'draft' | 'published' | 'archived';
  isAvailable: boolean;
  storefrontItemMode: 'INTERNAL_ONLY' | 'CONDITION_SUMMARY';
  availableFrom: string | null;
  unavailableReason: string | null;
  countryOfOrigin: string | null;
  countryOfOriginPublic: boolean;
  referenceRetailValue: number | null;
  referenceRetailValuePublic: boolean;
  totalBookings: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
  onboarding: {
    currentSection: ProductOnboardingSection;
    completedSections: ProductOnboardingSection[];
    revision: number;
    updatedAt: string;
  } | null;
  // Relations
  category: { id: string; name: string; slug: string };
  subcategory: { id: string; name: string; slug: string } | null;
  events: Array<{ event: { id: string; name: string; slug: string } }>;
  pricing: PricingProfileData | null;
  productType: ProductTypeData | null;
  productTypeId: string | null;
  sizeSchemaOverrideId: string | null;
  sizeSchemaOverride: SizeSchemaData | null;
  sizing: SizingPayload | null;
  variants: ProductVariantData[];
  faqs: ProductFaqData[];
  detailHeaders: ProductDetailHeaderData[];
  readiness: ProductReadiness;
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  status?: 'draft' | 'published' | 'archived';
  search?: string;
  categoryId?: string;
  productTypeId?: string;
  readiness?: 'ready' | 'needs_attention';
  stockState?: 'in_stock' | 'no_stock';
  sort?: 'name' | 'status' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface UpdateProductInput {
  name?: string;
  categoryId?: string;
  subcategoryId?: string | null;
  eventIds?: string[];
  countryOfOrigin?: string | null;
  countryOfOriginPublic?: boolean;
  referenceRetailValue?: number | null;
  referenceRetailValuePublic?: boolean;
  productTypeId?: string;
  sizeSchemaOverrideId?: string | null;
}

export interface ProductOnboardingVariantInput {
  id?: string;
  clientKey: string;
  variantName?: string;
  mainColorId: string;
  identicalColorIds?: string[];
  sizes: VariantSizeInventoryInput[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

const onboardingHeaders = (idempotencyKey: string) => ({
  headers: { 'Idempotency-Key': idempotencyKey },
});

export const productOnboardingApi = {
  start: async (
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProductOnboarding> => {
    const { data } = await apiClient.post<ApiResponse<ProductOnboarding>>(
      '/owner/product-onboardings',
      payload,
      onboardingHeaders(idempotencyKey),
    );
    return data.data;
  },

  get: async (productId: string): Promise<ProductOnboarding> => {
    const { data } = await apiClient.get<ApiResponse<ProductOnboarding>>(
      `/owner/product-onboardings/${productId}`,
    );
    return data.data;
  },

  saveBasics: async (
    productId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProductOnboarding> => {
    const { data } = await apiClient.put<ApiResponse<ProductOnboarding>>(
      `/owner/product-onboardings/${productId}/basics`,
      payload,
      onboardingHeaders(idempotencyKey),
    );
    return data.data;
  },

  saveSkus: async (
    productId: string,
    payload: { expectedRevision: number; variants: ProductOnboardingVariantInput[] },
    idempotencyKey: string,
  ): Promise<ProductOnboarding> => {
    const { data } = await apiClient.put<ApiResponse<ProductOnboarding>>(
      `/owner/product-onboardings/${productId}/skus`,
      payload,
      onboardingHeaders(idempotencyKey),
    );
    return data.data;
  },

  saveContent: async (
    productId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProductOnboarding> => {
    const { data } = await apiClient.put<ApiResponse<ProductOnboarding>>(
      `/owner/product-onboardings/${productId}/content`,
      payload,
      onboardingHeaders(idempotencyKey),
    );
    return data.data;
  },

  savePricing: async (
    productId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProductOnboarding> => {
    const { data } = await apiClient.put<ApiResponse<ProductOnboarding>>(
      `/owner/product-onboardings/${productId}/pricing`,
      payload,
      onboardingHeaders(idempotencyKey),
    );
    return data.data;
  },

  publish: async (
    productId: string,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<ProductOnboarding> => {
    const { data } = await apiClient.post<ApiResponse<ProductOnboarding>>(
      `/owner/product-onboardings/${productId}/publish`,
      { expectedRevision },
      onboardingHeaders(idempotencyKey),
    );
    return data.data;
  },
};

export const productApi = {
  /**
   * GET /api/v1/owner/products
   */
  list: async (query?: ProductListQuery): Promise<PaginatedResponse<ProductListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<ProductListItem>>(
      '/owner/products',
      { params: query },
    );
    return data;
  },

  /**
   * GET /api/v1/owner/products/:id
   */
  getById: async (id: string): Promise<ProductDetail> => {
    const { data } = await apiClient.get<ApiResponse<ProductDetail>>(`/owner/products/${id}`);
    if (!data.success) throw new Error(data.message || 'Product not found');
    return data.data;
  },

  getReadiness: async (id: string): Promise<ProductReadiness> => {
    const { data } = await apiClient.get<ApiResponse<ProductReadiness>>(
      `/owner/products/${id}/readiness`,
    );
    return data.data;
  },

  /**
   * DELETE /api/v1/owner/products/:id  (soft delete)
   */
  softDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/products/${id}`);
  },

  /**
   * PATCH /api/v1/owner/products/:id/status
   */
  updateStatus: async (id: string, status: string): Promise<void> => {
    await apiClient.patch(`/owner/products/${id}/status`, { status });
  },

  /**
   * POST /api/v1/owner/products/:id/restore
   */
  restore: async (id: string): Promise<void> => {
    await apiClient.post(`/owner/products/${id}/restore`);
  },

  /**
   * DELETE /api/v1/owner/products/:id/permanent
   */
  permanentDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/products/${id}/permanent`);
  },

  /**
   * GET /api/v1/owner/products/trash
   */
  listTrash: async (query?: { page?: number; limit?: number }): Promise<PaginatedResponse<ProductListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<ProductListItem>>(
      '/owner/products/trash',
      { params: query },
    );
    return data;
  },

  getOwnerCategories: async (): Promise<OwnerCategory[]> => {
    const { data } = await apiClient.get<ApiResponse<OwnerCategory[]>>('/owner/categories');
    return data.data;
  },

  getOwnerEvents: async (): Promise<Event[]> => {
    const { data } = await apiClient.get<ApiResponse<Event[]>>('/owner/events');
    return data.data;
  },

  getColors: async (): Promise<Color[]> => {
    const { data } = await apiClient.get<ApiResponse<Color[]>>('/colors');
    return data.data;
  },

  uploadImage: async (variantId: string, file: File, isFeatured: boolean = false): Promise<UploadedProductImage> => {
    const formData = new FormData();
    formData.append('variantId', variantId);
    formData.append('file', file);
    if (isFeatured) {
      formData.append('isFeatured', 'true');
    }

    const { data } = await apiClient.post<ApiResponse<UploadedProductImage>>('/owner/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data;
  },

  /**
   * PATCH /api/v1/owner/products/:id  (update product)
   */
  updateProduct: async (id: string, payload: UpdateProductInput): Promise<Record<string, unknown>> => {
    const { data } = await apiClient.patch<ApiResponse<Record<string, unknown>>>(`/owner/products/${id}`, payload);
    return data.data;
  },

  /**
   * PUT /api/v1/owner/upload/product-images/:variantId
   */
  syncImages: async (
    variantId: string,
    imageIds: string[],
    featuredImageId: string,
  ): Promise<void> => {
    await apiClient.put(`/owner/upload/product-images/${variantId}`, {
      ids: imageIds,
      featuredImageId,
    });
  },

  // ─── Category CRUD ──────────────────────────────────────────────────────────

  createCategory: async (payload: { name: string; icon?: string; displayOrder?: number }): Promise<OwnerCategory> => {
    const { data } = await apiClient.post<ApiResponse<OwnerCategory>>('/owner/categories', payload);
    return data.data;
  },

  updateCategory: async (id: string, payload: { name?: string; icon?: string; displayOrder?: number; isActive?: boolean }): Promise<OwnerCategory> => {
    const { data } = await apiClient.patch<ApiResponse<OwnerCategory>>(`/owner/categories/${id}`, payload);
    return data.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/categories/${id}`);
  },

  // ─── Subcategory CRUD ───────────────────────────────────────────────────────

  createSubcategory: async (categoryId: string, payload: { name: string; displayOrder?: number }): Promise<OwnerSubcategory> => {
    const { data } = await apiClient.post<ApiResponse<OwnerSubcategory>>(`/owner/categories/${categoryId}/subcategories`, payload);
    return data.data;
  },

  updateSubcategory: async (id: string, payload: { name?: string; displayOrder?: number; isActive?: boolean }): Promise<OwnerSubcategory> => {
    const { data } = await apiClient.patch<ApiResponse<OwnerSubcategory>>(`/owner/subcategories/${id}`, payload);
    return data.data;
  },

  deleteSubcategory: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/subcategories/${id}`);
  },

  // ─── Event CRUD ─────────────────────────────────────────────────────────────

  getOwnerEventsManage: async (): Promise<OwnerEvent[]> => {
    const { data } = await apiClient.get<ApiResponse<OwnerEvent[]>>('/owner/events');
    return data.data;
  },

  createEvent: async (payload: { name: string; displayOrder?: number }): Promise<OwnerEvent> => {
    const { data } = await apiClient.post<ApiResponse<OwnerEvent>>('/owner/events', payload);
    return data.data;
  },

  updateEvent: async (id: string, payload: { name?: string; displayOrder?: number; isActive?: boolean }): Promise<OwnerEvent> => {
    const { data } = await apiClient.patch<ApiResponse<OwnerEvent>>(`/owner/events/${id}`, payload);
    return data.data;
  },

  deleteEvent: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/events/${id}`);
  },

  // ─── Pricing Engine v2 ─────────────────────────────────────────────────────

  /**
   * GET /api/products/:productId/pricing
   */
  getPricing: async (productId: string): Promise<Record<string, unknown> | null> => {
    const { data } = await apiClient.get<ApiResponse<Record<string, unknown> | null>>(`/products/${productId}/pricing`);
    return data.data;
  },

  /**
   * POST /api/products/:productId/pricing/simulate
   */
  simulatePricing: async (productId: string, payload: { startAt: string; endAt: string; selectedAddons?: string[] }): Promise<Record<string, unknown>> => {
    const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>(`/products/${productId}/pricing/simulate`, payload);
    return data.data;
  },

  getInventory: async (productId: string): Promise<ProductInventory> => {
    const { data } = await apiClient.get<ApiResponse<ProductInventory>>(`/owner/products/${productId}/inventory`);
    return data.data;
  },

  listStockUnits: async (variantSizeId: string): Promise<StockUnit[]> => {
    const { data } = await apiClient.get<ApiResponse<StockUnit[]>>(`/owner/variant-sizes/${variantSizeId}/stock-units`);
    return data.data;
  },

  updateStockUnit: async (stockUnitId: string, payload: Record<string, unknown>): Promise<StockUnit> => {
    const { data } = await apiClient.patch<ApiResponse<StockUnit>>(`/owner/stock-units/${stockUnitId}`, payload);
    return data.data;
  },

  changeStockUnitLifecycle: async (stockUnitId: string, action: 'maintenance' | 'restore' | 'retire' | 'lost', reason: string): Promise<void> => {
    await apiClient.post(`/owner/stock-units/${stockUnitId}/${action}`, { reason });
  },

  getInventoryCalendar: async (productId: string, from: string, to: string): Promise<InventoryCalendar> => {
    const { data } = await apiClient.get<ApiResponse<InventoryCalendar>>(`/owner/products/${productId}/inventory/calendar`, { params: { from, to } });
    return data.data;
  },

  listInventoryMovements: async (variantSizeId: string): Promise<InventoryMovement[]> => {
    const { data } = await apiClient.get<ApiResponse<InventoryMovement[]>>(`/owner/variant-sizes/${variantSizeId}/inventory-movements`);
    return data.data;
  },
};

export interface UploadedProductImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  isFeatured: boolean;
}

export interface VariantSizeInventoryInput {
  sizeInstanceId: string;
}

export interface ProductInventorySize {
  variantSizeId: string;
  sizeInstance: SizeInstanceData;
  inventoryVersion: number;
  totalCapacity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unitCounts: Array<{
    locationId: string;
    disposition: StockUnit['disposition'];
    operationalState: StockUnit['operationalState'];
    quantity: number;
  }>;
}

export interface ProductInventory {
  id: string;
  name: string;
  status: string;
  isAvailable: boolean;
  storefrontItemMode: 'INTERNAL_ONLY' | 'CONDITION_SUMMARY';
  variants: Array<{
    id: string;
    variantName: string | null;
    mainColor: { id: string; name: string; hexCode: string | null };
    sizes: ProductInventorySize[];
  }>;
}

export interface StockUnit {
  id: string;
  version: number;
  assetCode: string;
  barcode: string | null;
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  disposition: 'ACTIVE' | 'QUARANTINED' | 'LOST' | 'RETIRED';
  operationalState: 'AVAILABLE' | 'PREPARING' | 'READY' | 'OUT_FOR_RENTAL' | 'AWAITING_INSPECTION' | 'CLEANING' | 'WASHING' | 'REPAIRING' | 'IN_TRANSFER';
  storefrontVisible: boolean;
  publicConditionNote: string | null;
  rentalPriceAdjustment: number;
  estimatedCurrentValue: number | null;
  storefrontSortOrder: number;
  acquisitionDate: string | null;
  acquisitionCost: number | null;
  acquisitionSource: string | null;
  acquisitionReference: string | null;
  locationId: string;
  location: { id: string; code: string; name: string };
  notes: string | null;
  componentStates?: Array<{ id: string; presence: 'PRESENT' | 'MISSING' | 'DAMAGED' | 'NOT_APPLICABLE' }>;
  issues?: Array<{ id: string; status: string; isAvailabilityBlocking: boolean }>;
  serviceOrders?: Array<{ id: string; status: string; isAvailabilityBlocking: boolean }>;
}

export interface InventoryCalendarEntry {
  id: string;
  variantSizeId?: string | null;
  stockUnitId?: string | null;
  quantity?: number;
  status?: string;
  blockType?: string;
  blockedStartDate?: string;
  blockedEndDate?: string;
  startDate?: string;
  endDate?: string;
  reason?: string | null;
  canDelete?: boolean;
}

export interface InventoryCalendar {
  productId: string;
  from: string;
  to: string;
  reservations: InventoryCalendarEntry[];
  blocks: InventoryCalendarEntry[];
}

export interface InventoryMovement {
  id: string;
  movementType: string;
  reason: string | null;
  createdAt: string;
  stockUnit: { id: string; assetCode: string };
  actor: { id: string; fullName: string } | null;
}

// ─── Sizing Module API ──────────────────────────────────────────────────────

export const sizingApi = {
  // Product Types
  listProductTypes: async (): Promise<ProductTypeData[]> => {
    const { data } = await apiClient.get<ApiResponse<ProductTypeData[]>>('/owner/product-types');
    return data.data;
  },

  createProductType: async (payload: { name: string; description?: string; defaultSizeSchemaId?: string }): Promise<ProductTypeData> => {
    const { data } = await apiClient.post<ApiResponse<ProductTypeData>>('/owner/product-types', payload);
    return data.data;
  },

  updateProductType: async (id: string, payload: { name?: string; description?: string; defaultSizeSchemaId?: string; isActive?: boolean }): Promise<ProductTypeData> => {
    const { data } = await apiClient.patch<ApiResponse<ProductTypeData>>(`/owner/product-types/${id}`, payload);
    return data.data;
  },

  deleteProductType: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/product-types/${id}`);
  },

  // Size Schemas
  listSchemas: async (status?: string): Promise<SizeSchemaData[]> => {
    const { data } = await apiClient.get<ApiResponse<SizeSchemaData[]>>(`/owner/size-schemas${status ? `?status=${status}` : ''}`);
    return data.data;
  },

  getSchema: async (id: string): Promise<SizeSchemaData> => {
    const { data } = await apiClient.get<ApiResponse<SizeSchemaData>>(`/owner/size-schemas/${id}`);
    return data.data;
  },

  createSchema: async (payload: {
    code: string;
    name: string;
    description?: string;
    schemaType?: string;
    definition: SizeSchemaDefinition | Record<string, unknown>;
    instances?: CreateSizeInstanceInput[];
  }): Promise<SizeSchemaData> => {
    const { data } = await apiClient.post<ApiResponse<SizeSchemaData>>('/owner/size-schemas', payload);
    return data.data;
  },

  updateSchema: async (id: string, payload: {
    name?: string;
    description?: string;
    status?: string;
    definition?: SizeSchemaDefinition | Record<string, unknown>;
  }): Promise<SizeSchemaData> => {
    const { data } = await apiClient.patch<ApiResponse<SizeSchemaData>>(`/owner/size-schemas/${id}`, payload);
    return data.data;
  },

  activateSchema: async (id: string): Promise<void> => {
    await apiClient.post(`/owner/size-schemas/${id}/activate`);
  },

  deprecateSchema: async (id: string): Promise<void> => {
    await apiClient.post(`/owner/size-schemas/${id}/deprecate`);
  },

  deleteSchema: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/size-schemas/${id}`);
  },

  createSizeInstances: async (schemaId: string, labels: string[]): Promise<SizeInstanceData[]> => {
    const { data } = await apiClient.post<ApiResponse<SizeInstanceData[]>>(
      '/owner/size-instances/bulk',
      { schemaId, labels },
    );
    return data.data;
  },

  deleteSizeInstance: async (id: string): Promise<void> => {
    await apiClient.delete(`/owner/size-instances/${id}`);
  },

  listCharts: async (schemaId?: string): Promise<SizeChartData[]> => {
    const { data } = await apiClient.get<ApiResponse<SizeChartData[]>>(`/owner/size-schemas/charts/list${schemaId ? `?schemaId=${schemaId}` : ''}`);
    return data.data;
  },

  getChart: async (chartId: string): Promise<SizeChartData> => {
    const { data } = await apiClient.get<ApiResponse<SizeChartData>>(`/owner/size-schemas/charts/${chartId}`);
    return data.data;
  },

  createSizeChart: async (payload: {
    sizeSchemaId: string;
    productId?: string;
    title?: string;
    rows?: CreateSizeChartRowInput[];
  }): Promise<SizeChartData> => {
    const { data } = await apiClient.post<ApiResponse<SizeChartData>>('/owner/size-schemas/charts', payload);
    return data.data;
  },

  updateSizeChart: async (chartId: string, payload: {
    title?: string;
    rows?: CreateSizeChartRowInput[];
  }): Promise<SizeChartData> => {
    const { data } = await apiClient.patch<ApiResponse<SizeChartData>>(
      `/owner/size-schemas/charts/${chartId}`,
      payload,
    );
    return data.data;
  },

  deleteSizeChart: async (chartId: string): Promise<void> => {
    await apiClient.delete(`/owner/size-schemas/charts/${chartId}`);
  },
};
