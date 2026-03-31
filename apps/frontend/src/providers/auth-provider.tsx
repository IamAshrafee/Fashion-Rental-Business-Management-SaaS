'use client';

/**
 * Auth Provider — manages authentication state via React Context.
 *
 * On mount, attempts to refresh the access token (via httpOnly cookie).
 * Exports `useAuth()` hook for consuming auth state.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthState, AuthUserInfo, LoginCredentials } from '@/types';
import {
  refreshAccessToken,
  loginWithCredentials,
  logout as logoutFn,
  clearAccessToken,
  setTenantIdLocal,
} from '@/lib/auth';
import apiClient from '@/lib/api-client';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    tenantId: null,
  });

  /** Attempt to restore session on mount */
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      // If an impersonation is pending or active, skip the normal refresh flow.
      // ImpersonationBoot will set the token — refreshing here would overwrite it
      // with the admin's own session from the httpOnly refresh cookie.
      if (typeof window !== 'undefined') {
        const hasImpersonation =
          !!localStorage.getItem('closetrent_impersonation') ||
          !!sessionStorage.getItem('closetrent_impersonation_token');
        if (hasImpersonation) {
          setState((s) => ({ ...s, isLoading: false }));
          return;
        }
      }

      try {
        const token = await refreshAccessToken();
        if (!token || cancelled) {
          setState((s) => ({ ...s, isLoading: false }));
          return;
        }

        // Fetch user profile
        const response = await apiClient.get<{
          success: boolean;
          data: AuthUserInfo;
        }>('/auth/me');

        if (!cancelled) {
          const fetchedUser = response.data.data as any;
          const extractedTid = fetchedUser.currentTenant?.id || fetchedUser.tenantId || null;
          setTenantIdLocal(extractedTid);
          setState({
            user: fetchedUser,
            isAuthenticated: true,
            isLoading: false,
            tenantId: extractedTid,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ user: null, isAuthenticated: false, isLoading: false, tenantId: null });
        }
      }
    }

    initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const user = await loginWithCredentials(
      credentials.emailOrPhone,
      credentials.password,
      credentials.tenantSlug,
    );
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      tenantId: user.tenantId,
    });
  }, []);

  const logout = useCallback(async () => {
    await logoutFn();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tenantId: null,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: AuthUserInfo;
      }>('/auth/me');
      const fetchedUser = response.data.data as any;
      const extractedTid = fetchedUser.currentTenant?.id || fetchedUser.tenantId || null;
      setTenantIdLocal(extractedTid);
      
      setState((s) => ({
        ...s,
        user: fetchedUser,
        isAuthenticated: true,
        tenantId: extractedTid,
      }));
    } catch {
      clearAccessToken();
      setState({ user: null, isAuthenticated: false, isLoading: false, tenantId: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
