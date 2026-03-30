import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '@/lib/api/customers';
import { CreateCustomerDto, UpdateCustomerDto } from '@closetrent/types';
import { toast } from 'sonner';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...customerKeys.lists(), { filters }] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  tags: () => [...customerKeys.all, 'tags'] as const,
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

export function useCustomerTags() {
  return useQuery({
    queryKey: customerKeys.tags(),
    queryFn: () => customerApi.getCustomerTags(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCustomerDto) =>
      customerApi.createCustomer(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customerKeys.tags() });
      const wasExisting = (data as { wasExisting?: boolean })?.wasExisting;
      if (wasExisting) {
        toast.info('Customer already exists — record updated');
      } else {
        toast.success('Customer created successfully');
      }
    },
    onError: () => {
      toast.error('Failed to create customer');
    },
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
      toast.success('Customer updated');
    },
    onError: () => {
      toast.error('Failed to update customer');
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      customerApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Customer deleted');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || 'Failed to delete customer';
      toast.error(msg);
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
      queryClient.invalidateQueries({ queryKey: customerKeys.tags() });
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
      queryClient.invalidateQueries({ queryKey: customerKeys.tags() });
    },
  });
}
