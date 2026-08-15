import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi, sizingApi } from '@/lib/api/products';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';

const showMutationError = (fallback: string) => (error: unknown) => {
  toast.error(getApiErrorMessage(error, fallback));
};

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
    onError: showMutationError('Failed to create category'),
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; icon?: string; displayOrder?: number; isActive?: boolean }) =>
      productApi.updateCategory(id, payload),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: unknown) => {
      showMutationError('Failed to update category')(error);
      invalidate(); // revert optimistic UI
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => productApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted');
      invalidate();
    },
    onError: showMutationError('Failed to delete category'),
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, ...payload }: { categoryId: string; name: string; displayOrder?: number }) =>
      productApi.createSubcategory(categoryId, payload),
    onSuccess: () => {
      toast.success('Subcategory created');
      invalidate();
    },
    onError: showMutationError('Failed to create subcategory'),
  });

  const updateSubcategory = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; displayOrder?: number; isActive?: boolean }) =>
      productApi.updateSubcategory(id, payload),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: unknown) => {
      showMutationError('Failed to update subcategory')(error);
      invalidate();
    },
  });

  const deleteSubcategory = useMutation({
    mutationFn: (id: string) => productApi.deleteSubcategory(id),
    onSuccess: () => {
      toast.success('Subcategory deleted');
      invalidate();
    },
    onError: showMutationError('Failed to delete subcategory'),
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
    onError: showMutationError('Failed to create event'),
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; displayOrder?: number; isActive?: boolean }) =>
      productApi.updateEvent(id, payload),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: unknown) => {
      showMutationError('Failed to update event')(error);
      invalidate();
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => productApi.deleteEvent(id),
    onSuccess: () => {
      toast.success('Event deleted');
      invalidate();
    },
    onError: showMutationError('Failed to delete event'),
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
    onError: showMutationError('Failed to move product to trash'),
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
    onError: showMutationError('Failed to restore product'),
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
    onError: showMutationError('Failed to permanently delete product'),
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
      queryClient.invalidateQueries({ queryKey: ['products', 'detail', variables.id] });
      const label = variables.status === 'published' ? 'Published' : variables.status === 'draft' ? 'Unpublished' : 'Archived';
      toast.success(`Product ${label}`);
    },
    onError: showMutationError('Failed to update status'),
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
    onError: showMutationError('Failed to create Product Type'),
  });

  const updateProductType = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; description?: string; defaultSizeSchemaId?: string; isActive?: boolean }) =>
      sizingApi.updateProductType(id, payload),
    onSuccess: () => {
      toast.success('Product Type updated');
      invalidate();
    },
    onError: showMutationError('Failed to update Product Type'),
  });

  const deleteProductType = useMutation({
    mutationFn: (id: string) => sizingApi.deleteProductType(id),
    onSuccess: () => {
      toast.success('Product Type deleted');
      invalidate();
    },
    onError: showMutationError('Failed to delete Product Type'),
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
    mutationFn: (payload: Parameters<typeof sizingApi.createSchema>[0]) =>
      sizingApi.createSchema(payload),
    onSuccess: () => {
      toast.success('Size Schema created');
      invalidate();
    },
    onError: showMutationError('Failed to create Size Schema'),
  });

  const updateSchema = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof sizingApi.updateSchema>[1]) =>
      sizingApi.updateSchema(id, payload),
    onSuccess: () => {
      toast.success('Size Schema updated');
      invalidate();
    },
    onError: showMutationError('Failed to update Size Schema'),
  });

  const activateSchema = useMutation({
    mutationFn: (id: string) => sizingApi.activateSchema(id),
    onSuccess: () => {
      toast.success('Size Schema activated (Now available for product types)');
      invalidate();
    },
    onError: showMutationError('Failed to activate Size Schema'),
  });

  const deprecateSchema = useMutation({
    mutationFn: (id: string) => sizingApi.deprecateSchema(id),
    onSuccess: () => {
      toast.success('Size Schema deprecated (Hidden from new product types)');
      invalidate();
    },
    onError: showMutationError('Failed to deprecate Size Schema'),
  });

  const deleteSchema = useMutation({
    mutationFn: (id: string) => sizingApi.deleteSchema(id),
    onSuccess: () => {
      toast.success('Size Schema deleted');
      invalidate();
    },
    onError: showMutationError('Failed to delete Size Schema'),
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
    mutationFn: (payload: Parameters<typeof sizingApi.createSizeChart>[0]) =>
      sizingApi.createSizeChart(payload),
    onSuccess: () => {
      toast.success('Size Guide saved successfully');
      invalidate();
    },
    onError: showMutationError('Failed to save Size Guide'),
  });

  const deleteChart = useMutation({
    mutationFn: (id: string) => sizingApi.deleteSizeChart(id),
    onSuccess: () => {
      toast.success('Size Guide deleted');
      invalidate();
    },
    onError: showMutationError('Failed to delete Size Guide'),
  });

  return { createChart, deleteChart };
}
