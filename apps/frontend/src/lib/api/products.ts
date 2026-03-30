import apiClient from '../api-client';
import type { ApiResponse, PaginatedResponse } from '@closetrent/types';

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
  hex: string | null;
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

export interface ProductDetail extends ProductListItem {
  description: string | null;
  subcategory?: { id: string; name: string } | null;
  events: Array<{ id: string; name: string }>;
  securityDeposit: number;
  cleaningFee: number;
  cleaningFeeEnabled: boolean;
  backupSizeFee: number;
  backupSizeEnabled: boolean;
  tryOnFee: number;
  tryOnEnabled: boolean;
  includedDays: number;
  pricePerDay: number;
  retailPrice: number | null;
  rentalPercentage: number | null;
  minPrice: number | null;
  maxDiscount: number | null;
  sizeMode: string;
  measurements: Record<string, unknown> | null;
  details: Array<{ header: string; items: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
  purchasePrice: number | null;
  purchaseDate: string | null;
  purchaseCountry: string | null;
  supplierName: string | null;
  revenue: number;
  updatedAt: string;
  deletedAt: string | null;
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

  addVariant: async (productId: string, payload: { variantName?: string; mainColorId: string; identicalColorIds?: string[] }): Promise<{ id: string }> => {
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
    payload: { variantName?: string; mainColorId?: string; identicalColorIds?: string[] },
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
