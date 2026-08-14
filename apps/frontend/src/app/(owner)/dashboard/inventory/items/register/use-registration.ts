'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, type BatchInventoryItemInput } from '@/lib/api/inventory';

export interface RegistrationRowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export function registrationFailure(error: unknown): {
  message: string;
  errors: RegistrationRowError[];
} {
  const response = (
    error as {
      response?: {
        data?: {
          message?: string | { message?: string; errors?: RegistrationRowError[] };
          errors?: RegistrationRowError[];
        };
      };
    }
  )?.response?.data;
  const nested = typeof response?.message === 'object' ? response.message : undefined;
  return {
    message:
      (typeof response?.message === 'string' ? response.message : nested?.message) ??
      'The physical items could not be registered.',
    errors: response?.errors ?? nested?.errors ?? [],
  };
}

export function useRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantSizeId, payload }: { variantSizeId: string; payload: BatchInventoryItemInput }) =>
      inventoryApi.registerItemBatch(variantSizeId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-skus'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['product-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      ]);
    },
  });
}
