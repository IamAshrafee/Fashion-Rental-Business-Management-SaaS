import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/settings';
import { staffApi } from '@/lib/api/staff';
import { sessionApi } from '@/lib/api/sessions';
import { 
  UpdateStoreSettingsDto, 
  UpdateLocaleSettingsDto, 
  UpdatePaymentSettingsDto, 
  UpdateCourierSettingsDto, 
  UpdateOperationalSettingsDto,
  StaffQueryDto,
  InviteStaffDto,
  UpdateStaffDto,
  SetCustomDomainDto
} from '@closetrent/types';
import { toast } from 'sonner';

// ==========================================
// STORE SETTINGS HOOKS
// ==========================================

export const useStoreSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getStoreSettings,
  });
};

export const useUpdateStoreSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateStoreSettingsDto) => settingsApi.updateStoreSettings(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update settings');
    },
  });
};

export const useUpdateLocaleSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateLocaleSettingsDto) => settingsApi.updateLocaleSettings(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Locale settings updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update locale');
    },
  });
};

export const useUpdatePaymentSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdatePaymentSettingsDto) => settingsApi.updatePaymentSettings(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Payment configuration updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update payment settings');
    },
  });
};

export const useUpdateCourierSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCourierSettingsDto) => settingsApi.updateCourierSettings(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Courier configuration updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update courier settings');
    },
  });
};

export const useUpdateOperationalSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateOperationalSettingsDto) => settingsApi.updateOperationalSettings(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Operational settings updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update operational settings');
    },
  });
};

export const useManageCustomDomain = () => {
  const queryClient = useQueryClient();
  
  const setDomain = useMutation({
    mutationFn: (dto: SetCustomDomainDto) => settingsApi.setCustomDomain(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Domain configured successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to configure domain');
    },
  });

  const verifyDomain = useMutation({
    mutationFn: () => settingsApi.verifyCustomDomain(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Domain verified successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'DNS verification failed. Please check your records and try again later.');
    },
  });

  const removeDomain = useMutation({
    mutationFn: () => settingsApi.removeCustomDomain(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Custom domain removed');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to remove domain');
    },
  });

  return { setDomain, verifyDomain, removeDomain };
};

export const useSubscription = () => {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: settingsApi.getSubscription,
  });
};

export const useResourceUsage = () => {
  return useQuery({
    queryKey: ['resource-usage'],
    queryFn: settingsApi.getResourceUsage,
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Logo uploaded successfully');
      return response;
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to upload logo');
    },
  });
};

// ==========================================
// STAFF MANAGEMENT HOOKS
// ==========================================

export const useStaffList = (query?: StaffQueryDto) => {
  return useQuery({
    queryKey: ['staff', query],
    queryFn: () => staffApi.listStaff(query),
  });
};

export const useStaffMember = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffApi.getStaff(id),
    enabled: !!id && enabled,
  });
};

export const useInviteStaff = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: InviteStaffDto) => staffApi.inviteStaff(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member invited successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to invite staff');
    },
  });
};

export const useUpdateStaff = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateStaffDto) => staffApi.updateStaff(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff role updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update staff');
    },
  });
};

export const useRemoveStaff = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffApi.removeStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member removed');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to remove staff member');
    },
  });
};

// ==========================================
// SESSION MANAGEMENT HOOKS
// ==========================================

export const useListMySessions = () => {
  return useQuery({
    queryKey: ['sessions', 'me'],
    queryFn: () => sessionApi.listMySessions(),
  });
};

export const useListTenantSessions = () => {
  return useQuery({
    queryKey: ['sessions', 'tenant'],
    queryFn: () => sessionApi.listTenantSessions(),
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isStaff }: { id: string; isStaff?: boolean }) => 
      isStaff ? sessionApi.revokeStaffSession(id) : sessionApi.revokeMySession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to revoke session');
    },
  });
};

export const useRevokeAllOtherSessions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sessionApi.revokeAllMyOtherSessions(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(res.data?.message || 'All other sessions revoked');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to revoke sessions');
    },
  });
};

export const useLoginHistory = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['sessions', 'history', page, limit],
    queryFn: () => sessionApi.getLoginHistory({ page, limit }),
  });
};
