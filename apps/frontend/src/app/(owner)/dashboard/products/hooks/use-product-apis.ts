import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi, sizingApi } from '@/lib/api/products';
import { toast } from 'sonner';

export function useCategories() {
  return useQuery({
    queryKey: ['owner-categories'],
    queryFn: () => productApi.getOwnerCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ['owner-events'],
    queryFn: () => productApi.getOwnerEvents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => productApi.getColors(),
    staleTime: 5 * 60 * 1000, // standard lookup data
  });
}

// ─── Category Mutations ───────────────────────────────────────────────────────

export function useCategoryMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-categories'] });
  };

  const createCategory = useMutation({
    mutationFn: (payload: { name: string; icon?: string; displayOrder?: number }) =>
      productApi.createCategory(payload),
    onSuccess: () => {
      toast.success('Category created');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create category');
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; icon?: string; displayOrder?: number; isActive?: boolean }) =>
      productApi.updateCategory(id, payload),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update category');
      invalidate(); // revert optimistic UI
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => productApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    },
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, ...payload }: { categoryId: string; name: string; displayOrder?: number }) =>
      productApi.createSubcategory(categoryId, payload),
    onSuccess: () => {
      toast.success('Subcategory created');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create subcategory');
    },
  });

  const updateSubcategory = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; displayOrder?: number; isActive?: boolean }) =>
      productApi.updateSubcategory(id, payload),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update subcategory');
      invalidate();
    },
  });

  const deleteSubcategory = useMutation({
    mutationFn: (id: string) => productApi.deleteSubcategory(id),
    onSuccess: () => {
      toast.success('Subcategory deleted');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete subcategory');
    },
  });

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  };
}

// ─── Event Hooks ──────────────────────────────────────────────────────────────

export function useEventsManage() {
  return useQuery({
    queryKey: ['owner-events-manage'],
    queryFn: () => productApi.getOwnerEventsManage(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEventMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-events-manage'] });
    queryClient.invalidateQueries({ queryKey: ['owner-events'] });
  };

  const createEvent = useMutation({
    mutationFn: (payload: { name: string; displayOrder?: number }) =>
      productApi.createEvent(payload),
    onSuccess: () => {
      toast.success('Event created');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create event');
    },
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; displayOrder?: number; isActive?: boolean }) =>
      productApi.updateEvent(id, payload),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update event');
      invalidate();
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => productApi.deleteEvent(id),
    onSuccess: () => {
      toast.success('Event deleted');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete event');
    },
  });

  return { createEvent, updateEvent, deleteEvent };
}

// ─── Product Trash Mutations ───────────────────────────────────────────────────

/**
 * Move a product to trash (soft delete).
 * Blocked by the backend if there are active or future bookings.
 */
export function useSoftDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productApi.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'trash'] });
      toast.success('Product moved to trash');
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message || 'Failed to move product to trash';
      toast.error(message);
    },
  });
}

/**
 * Restore a product from trash (sets back to draft).
 */
export function useRestoreProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'trash'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
      toast.success('Product restored to Draft — review and publish when ready');
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || 'Failed to restore product';
      toast.error(message);
    },
  });
}

/**
 * Permanently delete a product from trash. Irreversible.
 * Blocked by the backend if there are still active bookings.
 */
export function usePermanentDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productApi.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'trash'] });
      toast.success('Product permanently deleted');
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message || 'Failed to permanently delete product';
      toast.error(message);
    },
  });
}

/**
 * Update product status (draft/published/archived).
 */
export function useUpdateProductStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      productApi.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const label = variables.status === 'published' ? 'Published' : variables.status === 'draft' ? 'Unpublished' : 'Archived';
      toast.success(`Product ${label}`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || 'Failed to update status';
      toast.error(message);
    },
  });
}

// ─── Sizing Hooks ──────────────────────────────────────────────────────────────

export function useProductTypes() {
  return useQuery({
    queryKey: ['owner-product-types'],
    queryFn: () => sizingApi.listProductTypes(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProductTypeMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-product-types'] });
  };

  const createProductType = useMutation({
    mutationFn: (payload: { name: string; description?: string; defaultSizeSchemaId?: string }) =>
      sizingApi.createProductType(payload),
    onSuccess: () => {
      toast.success('Product Type created');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create Product Type');
    },
  });

  const updateProductType = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; description?: string; defaultSizeSchemaId?: string; isActive?: boolean }) =>
      sizingApi.updateProductType(id, payload),
    onSuccess: () => {
      toast.success('Product Type updated');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update Product Type');
    },
  });

  const deleteProductType = useMutation({
    mutationFn: (id: string) => sizingApi.deleteProductType(id),
    onSuccess: () => {
      toast.success('Product Type deleted');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete Product Type');
    },
  });

  return { createProductType, updateProductType, deleteProductType };
}

export function useSizeSchemas() {
  return useQuery({
    queryKey: ['owner-size-schemas'],
    queryFn: () => sizingApi.listSchemas(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSizeSchemaMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-size-schemas'] });
  };

  const createSchema = useMutation({
    mutationFn: (payload: { code: string; name: string; description?: string; schemaType?: string; definition: any; instances?: any[] }) =>
      sizingApi.createSchema(payload),
    onSuccess: () => {
      toast.success('Size Schema created');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create Size Schema');
    },
  });

  const updateSchema = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; description?: string; status?: string; definition?: any }) =>
      sizingApi.updateSchema(id, payload),
    onSuccess: () => {
      toast.success('Size Schema updated');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update Size Schema');
    },
  });

  const activateSchema = useMutation({
    mutationFn: (id: string) => sizingApi.activateSchema(id),
    onSuccess: () => {
      toast.success('Size Schema activated (Now available for product types)');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to activate Size Schema');
    },
  });

  const deprecateSchema = useMutation({
    mutationFn: (id: string) => sizingApi.deprecateSchema(id),
    onSuccess: () => {
      toast.success('Size Schema deprecated (Hidden from new product types)');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to deprecate Size Schema');
    },
  });

  const deleteSchema = useMutation({
    mutationFn: (id: string) => sizingApi.deleteSchema(id),
    onSuccess: () => {
      toast.success('Size Schema deleted');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete Size Schema');
    },
  });

  return { createSchema, updateSchema, activateSchema, deprecateSchema, deleteSchema };
}

export function useSizeCharts(schemaId?: string) {
  return useQuery({
    queryKey: ['owner-size-charts', schemaId],
    queryFn: () => sizingApi.listCharts(schemaId),
    enabled: !!schemaId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSizeChartMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-size-charts'] });
    queryClient.invalidateQueries({ queryKey: ['owner-size-schemas'] });
  };

  const createChart = useMutation({
    mutationFn: (payload: { sizeSchemaId: string; productId?: string; title?: string; rows?: any[] }) =>
      sizingApi.createSizeChart(payload),
    onSuccess: () => {
      toast.success('Size Guide saved successfully');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save Size Guide');
    },
  });

  const deleteChart = useMutation({
    mutationFn: (id: string) => sizingApi.deleteSizeChart(id),
    onSuccess: () => {
      toast.success('Size Guide deleted');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete Size Guide');
    },
  });

  return { createChart, deleteChart };
}
