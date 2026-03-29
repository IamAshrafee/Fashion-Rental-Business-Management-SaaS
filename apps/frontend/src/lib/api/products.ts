import apiClient from '../api-client';
import type { ApiResponse } from '@closetrent/types';

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

export interface Color {
  id: string;
  name: string;
  hex: string | null;
}

export const productApi = {
  getOwnerCategories: async (): Promise<Category[]> => {
    const { data } = await apiClient.get<ApiResponse<Category[]>>('/owner/categories');
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

  createProduct: async (payload: any): Promise<{ id: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ id: string }>>('/owner/products', payload);
    return data.data;
  },

  addVariant: async (productId: string, payload: { variantName?: string; mainColorId: string; identicalColorIds?: string[] }): Promise<{ id: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ id: string }>>(`/owner/products/${productId}/variants`, payload);
    return data.data;
  },

  uploadImage: async (variantId: string, file: File, isFeatured: boolean = false): Promise<any> => {
    const formData = new FormData();
    formData.append('variantId', variantId);
    formData.append('file', file);
    if (isFeatured) {
      formData.append('isFeatured', 'true');
    }

    const { data } = await apiClient.post<ApiResponse<any>>('/owner/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data;
  },
};
