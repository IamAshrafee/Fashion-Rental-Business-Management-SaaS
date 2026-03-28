import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '@/lib/api/customers';
import { Customer, CustomerDetail, UpdateCustomerDto, AddCustomerTagDto } from '@closetrent/types';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...customerKeys.lists(), { filters }] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCustomers(params: { page?: number; limit?: number; search?: string; tag?: string; sort?: string }) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => customerApi.getCustomers(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customerApi.getCustomerById(id),
    enabled: !!id,
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCustomerDto }) =>
      customerApi.updateCustomer(id, payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(customerKeys.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useAddCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      customerApi.addCustomerTag(id, { tag }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useRemoveCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      customerApi.removeCustomerTag(id, tag),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
