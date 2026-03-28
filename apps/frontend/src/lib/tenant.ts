/**
 * Tenant Resolution — ClosetRent Frontend
 *
 * Resolves the current tenant from the request hostname.
 * Used by both server components (SSR) and client components.
 */

import apiClient from './api-client';
import type { TenantPublicInfo } from '@/types';

/**
 * Extract the subdomain from a hostname.
 *
 * Examples:
 * - "mypremium.closetrent.com" → "mypremium"
 * - "localhost:3000" → null (dev mode, use default tenant)
 * - "mycustomdomain.com" → null (custom domain, resolve by domain)
 */
export function extractSubdomain(hostname: string): string | null {
  // In development, no subdomain extraction needed
  if (hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1')) {
    return null;
  }

  // For *.closetrent.com — extract subdomain
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  // Custom domain — no subdomain
  return null;
}

/**
 * Fetch tenant public info from the backend.
 *
 * First tries subdomain, then falls back to custom domain.
 */
export async function fetchTenantByHost(
  hostname: string,
): Promise<TenantPublicInfo | null> {
  try {
    const subdomain = extractSubdomain(hostname);

    if (subdomain) {
      const response = await apiClient.get<{
        success: boolean;
        data: TenantPublicInfo;
      }>(`/tenants/by-subdomain/${subdomain}`);
      return response.data.data;
    }

    // Custom domain resolution
    if (
      !hostname.startsWith('localhost') &&
      !hostname.startsWith('127.0.0.1')
    ) {
      const response = await apiClient.get<{
        success: boolean;
        data: TenantPublicInfo;
      }>(`/tenants/by-domain/${hostname}`);
      return response.data.data;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Apply tenant branding colours to the document's CSS custom properties.
 * Called client-side after tenant info is loaded.
 */
export function applyTenantBranding(tenant: TenantPublicInfo): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (tenant.primaryColor) {
    root.style.setProperty('--brand-primary', tenant.primaryColor);
    root.style.setProperty('--brand-600', tenant.primaryColor);
  }
  if (tenant.secondaryColor) {
    root.style.setProperty('--brand-secondary', tenant.secondaryColor);
  }
}
