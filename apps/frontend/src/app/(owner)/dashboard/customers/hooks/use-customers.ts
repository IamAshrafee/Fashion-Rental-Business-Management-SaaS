import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateCustomerDto, UpdateCustomerDto } from '@closetrent/types';
import { customerApi, CustomerListParams } from '@/lib/api/customers';
import { toast } from 'sonner';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => ['customers', 'list'] as const,
  list: (filters: CustomerListParams) => ['customers', 'list', filters] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
  tags: () => ['customers', 'tags'] as const,
};

const message = (error: unknown, fallback: string) => {
  const response = error as { response?: { data?: { message?: string | { message?: string } } } };
  const value = response.response?.data?.message;
  return typeof value === 'string' ? value : value?.message ?? fallback;
};

export function useCustomers(params: CustomerListParams) {
  return useQuery({ queryKey: customerKeys.list(params), queryFn: () => customerApi.getCustomers(params) });
}

export function useCustomer(id: string) {
  return useQuery({ queryKey: customerKeys.detail(id), queryFn: () => customerApi.getCustomerById(id), enabled: !!id });
}

export function useCustomerTags() {
  return useQuery({ queryKey: customerKeys.tags(), queryFn: customerApi.getCustomerTags, staleTime: 5 * 60 * 1000 });
}

function useCustomerMutation<TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<unknown>;
  customerId?: (variables: TVariables) => string | undefined;
  success: string;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (_, variables) => {
      const customerId = options.customerId?.(variables);
      if (customerId) queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customerKeys.tags() });
      toast.success(options.success);
    },
    onError: (error) => toast.error(message(error, 'The customer change could not be saved')),
  });
}

export function useCreateCustomer() {
  return useCustomerMutation<CreateCustomerDto>({ mutationFn: customerApi.createCustomer, success: 'Customer created' });
}

export function useUpdateCustomer() {
  return useCustomerMutation<{ id: string; payload: UpdateCustomerDto }>({ mutationFn: ({ id, payload }) => customerApi.updateCustomer(id, payload), customerId: ({ id }) => id, success: 'Customer profile updated' });
}

export function useArchiveCustomer() {
  return useCustomerMutation<string>({ mutationFn: customerApi.archiveCustomer, success: 'Customer archived' });
}

export function useAddIdentity() {
  return useCustomerMutation<{ id: string; kind: 'phone' | 'email'; value: string }>({ mutationFn: ({ id, ...payload }) => customerApi.addIdentity(id, payload), customerId: ({ id }) => id, success: 'Contact added' });
}

export function useSetPrimaryIdentity() {
  return useCustomerMutation<{ id: string; identityId: string }>({ mutationFn: ({ id, identityId }) => customerApi.setPrimaryIdentity(id, identityId), customerId: ({ id }) => id, success: 'Primary contact changed' });
}

export function useRemoveIdentity() {
  return useCustomerMutation<{ id: string; identityId: string }>({ mutationFn: ({ id, identityId }) => customerApi.removeIdentity(id, identityId), customerId: ({ id }) => id, success: 'Contact removed' });
}

export function useAddAddress() {
  return useCustomerMutation<{ id: string; payload: Parameters<typeof customerApi.addAddress>[1] }>({ mutationFn: ({ id, payload }) => customerApi.addAddress(id, payload), customerId: ({ id }) => id, success: 'Address added' });
}

export function useAddNote() {
  return useCustomerMutation<{ id: string; body: string; isPinned?: boolean }>({ mutationFn: ({ id, ...payload }) => customerApi.addNote(id, payload), customerId: ({ id }) => id, success: 'Note added' });
}

export function useRecordConsent() {
  return useCustomerMutation<{ id: string; purpose: string; channel?: string; granted: boolean; source: string }>({ mutationFn: ({ id, ...payload }) => customerApi.recordConsent(id, payload), customerId: ({ id }) => id, success: 'Consent history updated' });
}

export function useCreateCustomerTag() {
  return useCustomerMutation<{ name: string; color?: string }>({ mutationFn: customerApi.createCustomerTag, success: 'Tag created' });
}

export function useAssignCustomerTag() {
  return useCustomerMutation<{ id: string; tagId: string }>({ mutationFn: ({ id, tagId }) => customerApi.addCustomerTag(id, { tagId }), customerId: ({ id }) => id, success: 'Tag assigned' });
}

export function useRemoveCustomerTag() {
  return useCustomerMutation<{ id: string; tagId: string }>({ mutationFn: ({ id, tagId }) => customerApi.removeCustomerTag(id, tagId), customerId: ({ id }) => id, success: 'Tag removed' });
}
