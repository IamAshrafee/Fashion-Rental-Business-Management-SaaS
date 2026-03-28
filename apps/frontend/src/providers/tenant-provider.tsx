'use client';

/**
 * Tenant Provider — loads and caches tenant info in React Context.
 *
 * For the guest portal, tenant info is loaded from hostname.
 * For the owner portal, tenant info comes from the auth context.
 *
 * Exports `useTenant()` hook for consuming tenant state.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { TenantPublicInfo, TenantLocale } from '@/types';
import { fetchTenantByHost, applyTenantBranding } from '@/lib/tenant';

interface TenantContextValue {
  tenant: TenantPublicInfo | null;
  locale: TenantLocale;
  isLoading: boolean;
}

/** Default locale when no tenant is loaded yet */
const DEFAULT_LOCALE: TenantLocale = {
  country: 'BD',
  timezone: 'Asia/Dhaka',
  currency: { code: 'BDT', symbol: '৳', symbolPosition: 'before' },
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'south_asian',
  timeFormat: '12h',
  weekStart: 'saturday',
};

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  locale: DEFAULT_LOCALE,
  isLoading: true,
});

interface TenantProviderProps {
  children: ReactNode;
  /** Pre-loaded tenant (for SSR or when already known) */
  initialTenant?: TenantPublicInfo | null;
}

export function TenantProvider({
  children,
  initialTenant = null,
}: TenantProviderProps) {
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(initialTenant);
  const [isLoading, setIsLoading] = useState(!initialTenant);

  useEffect(() => {
    if (initialTenant) {
      applyTenantBranding(initialTenant);
      return;
    }

    // Client-side: resolve from hostname
    if (typeof window === 'undefined') return;

    async function loadTenant() {
      try {
        const info = await fetchTenantByHost(window.location.hostname);
        if (info) {
          setTenant(info);
          applyTenantBranding(info);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTenant();
  }, [initialTenant]);

  const locale = tenant?.locale ?? DEFAULT_LOCALE;

  return (
    <TenantContext.Provider value={{ tenant, locale, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
