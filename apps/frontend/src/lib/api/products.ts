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
  status: string;
  rentalPrice: number;
  pricingMode: string;
  targetRentals: number;
  totalBookings: number;
  createdAt: string;
  category?: { id: string; name: string };
  variants: Array<{
    id: string;
    colorName: string;
    colorHex: string | null;
    images: Array<{ id: string; url: string; isFeatured: boolean }>;
  }>;
  _count?: { bookingItems: number };
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface ProductPricingData {
  id: string;
  mode: string;
  rentalPrice: number | null;
  includedDays: number | null;
  pricePerDay: number | null;
  minimumDays: number | null;
  retailPrice: number | null;
  rentalPercentage: number | null;
  calculatedPrice: number | null;
  priceOverride: number | null;
  minInternalPrice: number | null;
  maxDiscountPrice: number | null;
  extendedRentalRate: number | null;
  lateFeeType: string | null;
  lateFeeAmount: number | null;
  lateFeePercentage: number | null;
  maxLateFee: number | null;
  shippingMode: string | null;
  shippingFee: number | null;
}

export interface ProductServicesData {
  id: string;
  depositAmount: number | null;
  cleaningFee: number | null;
  backupSizeEnabled: boolean;
  backupSizeFee: number | null;
  tryOnEnabled: boolean;
  tryOnFee: number | null;
  tryOnDurationHours: number | null;
  tryOnCreditToRental: boolean;
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
  status: string;
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
  variantName: string | null;
  mainColorId: string;
  sequence: number;
  mainColor: { id: string; name: string; hexCode: string | null };
  identicalColors: Array<{ color: { id: string; name: string; hexCode: string | null } }>;
  sizeInstance: SizeInstanceData | null;
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    isFeatured: boolean;
    sequence: number;
    originalName: string | null;
  }>;
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
  status: string;
  isAvailable: boolean;
  availableFrom: string | null;
  unavailableReason: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  purchasePricePublic: boolean;
  itemCountry: string | null;
  itemCountryPublic: boolean;
  targetRentals: number | null;
  totalBookings: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
  // Relations
  category: { id: string; name: string; slug: string };
  subcategory: { id: string; name: string; slug: string } | null;
  events: Array<{ event: { id: string; name: string; slug: string } }>;
  pricing: ProductPricingData | null;
  services: ProductServicesData | null;
  productType: ProductTypeData | null;
  sizeSchemaOverride: SizeSchemaData | null;
  sizing: SizingPayload | null;
  variants: ProductVariantData[];
  faqs: ProductFaqData[];
  detailHeaders: ProductDetailHeaderData[];
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  categoryId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ─── API Functions ────────────────────────────────────────────────────────────

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

  /**
   * PATCH /api/v1/owner/products/:id/archive
   */
  archive: async (id: string): Promise<void> => {
    await apiClient.patch(`/owner/products/${id}/archive`);
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

  createProduct: async (payload: Record<string, unknown>): Promise<{ id: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ id: string }>>('/owner/products', payload);
    return data.data;
  },

  addVariant: async (productId: string, payload: { variantName?: string; mainColorId: string; sizeInstanceIds?: string[]; identicalColorIds?: string[] }): Promise<{ id: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ id: string }>>(`/owner/products/${productId}/variants`, payload);
    return data.data;
  },

  uploadImage: async (variantId: string, file: File, isFeatured: boolean = false): Promise<Record<string, unknown>> => {
    const formData = new FormData();
    formData.append('variantId', variantId);
    formData.append('file', file);
    if (isFeatured) {
      formData.append('isFeatured', 'true');
    }

    const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>('/owner/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data;
  },

  /**
   * PATCH /api/v1/owner/products/:id  (update product)
   */
  updateProduct: async (id: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const { data } = await apiClient.patch<ApiResponse<Record<string, unknown>>>(`/owner/products/${id}`, payload);
    return data.data;
  },

  /**
   * PATCH /api/v1/owner/products/:productId/variants/:variantId
   */
  updateVariant: async (
    productId: string,
    variantId: string,
    payload: { variantName?: string; mainColorId?: string; identicalColorIds?: string[]; sizeInstanceIds?: string[] },
  ): Promise<Record<string, unknown>> => {
    const { data } = await apiClient.patch<ApiResponse<Record<string, unknown>>>(
      `/owner/products/${productId}/variants/${variantId}`,
      payload,
    );
    return data.data;
  },

  /**
   * DELETE /api/v1/owner/products/:productId/variants/:variantId
   */
  deleteVariant: async (productId: string, variantId: string): Promise<void> => {
    await apiClient.delete(`/owner/products/${productId}/variants/${variantId}`);
  },

  /**
   * DELETE /api/v1/owner/upload/product-image/:imageId
   */
  deleteImage: async (imageId: string): Promise<void> => {
    await apiClient.delete(`/owner/upload/product-image/${imageId}`);
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
};

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

  createSchema: async (payload: { code: string; name: string; description?: string; schemaType?: string; definition: any; instances?: any[] }): Promise<SizeSchemaData> => {
    const { data } = await apiClient.post<ApiResponse<SizeSchemaData>>('/owner/size-schemas', payload);
    return data.data;
  },

  updateSchema: async (id: string, payload: { name?: string; description?: string; status?: string; definition?: any }): Promise<SizeSchemaData> => {
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

  listCharts: async (schemaId?: string): Promise<SizeChartData[]> => {
    const { data } = await apiClient.get<ApiResponse<SizeChartData[]>>(`/owner/size-schemas/charts/list${schemaId ? `?schemaId=${schemaId}` : ''}`);
    return data.data;
  },

  getChart: async (chartId: string): Promise<SizeChartData> => {
    const { data } = await apiClient.get<ApiResponse<SizeChartData>>(`/owner/size-schemas/charts/${chartId}`);
    return data.data;
  },

  createSizeChart: async (payload: { sizeSchemaId: string; productId?: string; title?: string; rows?: any[] }): Promise<SizeChartData> => {
    const { data } = await apiClient.post<ApiResponse<SizeChartData>>('/owner/size-schemas/charts', payload);
    return data.data;
  },

  deleteSizeChart: async (chartId: string): Promise<void> => {
    await apiClient.delete(`/owner/size-schemas/charts/${chartId}`);
  },
};
