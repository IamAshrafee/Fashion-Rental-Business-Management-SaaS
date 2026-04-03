/**
 * Tenant Resolution — ClosetRent Frontend
 *
 * Resolves the current tenant from the request hostname/host.
 * Supports three environments:
 *   - Development subdomains:  rentiva.localhost:3000
 *   - Development custom domains: rentbysara.local:3000  (via hosts file)
 *   - Production subdomains:  rentiva.closetrent.com
 *   - Production custom domains: rentbysara.com
 */

import axios from 'axios';
import type { TenantPublicInfo } from '@/types';

// ─────────────────────────────────────────────────────────────────────
// Subdomain Extraction
// ─────────────────────────────────────────────────────────────────────

/**
 * Extract the subdomain from a host string (hostname or host with port).
 *
 * Examples:
 *   "rentiva.localhost:3000"       → "rentiva"
 *   "rentiva.localhost"            → "rentiva"
 *   "rentiva.closetrent.com"      → "rentiva"
 *   "localhost:3000"               → null  (bare domain — landing page)
 *   "127.0.0.1:3000"              → null
 *   "rentbysara.local:3000"       → null  (custom domain, not a subdomain)
 *   "rentbysara.com"              → null  (custom domain)
 *   "admin.localhost:3000"        → "admin"
 */
export function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0]; // Strip port

  // Development: handle "subdomain.localhost"
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, -'.localhost'.length);
    return sub && !sub.includes('.') ? sub : null;
  }

  // Bare localhost or IP — no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Custom domain via hosts file (e.g., rentbysara.local) — not a subdomain
  if (hostname.endsWith('.local')) {
    return null;
  }

  // Production: "subdomain.closetrent.com" (3+ parts)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  // Custom domain (e.g., "rentbysara.com") — no subdomain
  return null;
}

/**
 * Check if the current host represents a custom domain (not a subdomain).
 *
 * Custom domains are:
 *   - *.local   (dev hosts file mapping, e.g., rentbysara.local)
 *   - bare TLD  (production, e.g., rentbysara.com — 2 parts, no subdomain)
 */
export function isCustomDomain(host: string): boolean {
  const hostname = host.split(':')[0];

  // Dev: hosts file custom domain (e.g., rentbysara.local)
  if (hostname.endsWith('.local') && !hostname.endsWith('.localhost')) {
    return true;
  }

  // Bare localhost/IP — not a custom domain, it's the platform itself
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }

  // Production: if it has no subdomain (2 parts like "rentbysara.com")
  // and it's not the base platform domain
  const parts = hostname.split('.');
  if (parts.length === 2) {
    const platformDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com';
    return hostname !== platformDomain.split(':')[0];
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────
// API URL Construction
// ─────────────────────────────────────────────────────────────────────

/**
 * Construct the API base URL that preserves the current subdomain/custom-domain
 * so the backend TenantMiddleware can resolve the tenant from the Host header.
 *
 *   rentiva.localhost:3000  → http://rentiva.localhost:4000/api/v1
 *   rentbysara.local:3000   → http://rentbysara.local:4000/api/v1
 *   rentiva.closetrent.com  → https://rentiva.closetrent.com/api/v1 (via Nginx)
 *   localhost:3000           → http://localhost:4000/api/v1 (no tenant)
 */
export function getSubdomainApiUrl(host: string): string {
  const hostname = host.split(':')[0];

  // Development: *.localhost → same subdomain on backend port
  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    return `http://${hostname}:4000/api/v1`;
  }

  // Development: custom domain via hosts file (*.local)
  if (hostname.endsWith('.local')) {
    return `http://${hostname}:4000/api/v1`;
  }

  // Production: API on same host via Nginx (/api/v1 path)
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${hostname}/api/v1`;
  }

  // Fallback (SSR)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
}

// ─────────────────────────────────────────────────────────────────────
// Tenant Fetching
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch tenant public info from the backend.
 *
 * The request is routed through the correct subdomain/custom-domain host
 * so the backend TenantMiddleware resolves the tenant from the Host header,
 * then GET /tenant/public returns the public store info.
 *
 * @param host — full host string including port (e.g., "rentiva.localhost:3000")
 */
export async function fetchTenantByHost(
  host: string,
): Promise<TenantPublicInfo | null> {
  try {
    const subdomain = extractSubdomain(host);
    const customDomain = isCustomDomain(host);

    // No subdomain and not a custom domain — this is the platform landing page
    if (!subdomain && !customDomain) {
      return null;
    }

    // Build API URL that preserves the tenant-identifying host
    const apiBaseUrl = getSubdomainApiUrl(host);

    const response = await axios.get<{
      success: boolean;
      data: TenantPublicInfo;
    }>(`${apiBaseUrl}/tenant/public`, {
      timeout: 5000,
      withCredentials: true,
    });

    return response.data.data;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Branding Application
// ─────────────────────────────────────────────────────────────────────

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
