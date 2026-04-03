/**
 * Next.js Middleware — ClosetRent Frontend
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ROUTING RULES (enforced strictly)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * BARE DOMAIN (localhost:3000 / closetrent.com):
 *   /                    → SaaS landing page (rewrite to /landing)
 *   /login               → Login (admins only, or redirect to subdomain)
 *   /register            → Registration (creates new store + subdomain)
 *   /admin/*             → SaaS admin portal (requires saas_admin role)
 *   /landing             → SaaS landing page
 *   EVERYTHING ELSE      → BLOCKED (redirect to landing with message)
 *
 * TENANT SUBDOMAIN (rentiva.localhost:3000 / rentiva.closetrent.com):
 *   /                    → Tenant storefront home
 *   /products/*          → Tenant product catalog
 *   /cart, /checkout     → Tenant shopping
 *   /booking/*           → Tenant booking flow
 *   /category/*          → Tenant categories
 *   /login               → Tenant owner/staff login
 *   /register            → Redirect to bare domain register
 *   /dashboard/*         → Tenant owner portal (requires auth)
 *   /store-suspended     → Suspension notice
 *   /landing             → Redirect to / (no landing on tenant subdomain)
 *   /admin/*             → Redirect to admin.localhost (wrong subdomain)
 *
 * ADMIN SUBDOMAIN (admin.localhost:3000 / admin.closetrent.com):
 *   /admin/*             → SaaS admin portal
 *   /login               → Admin login
 *   EVERYTHING ELSE      → Redirect to /admin
 *
 * CUSTOM DOMAIN (rentbysara.local / rentbysara.com):
 *   Same as TENANT SUBDOMAIN
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Marker cookie set by backend on login, cleared on logout */
const SESSION_COOKIE = 'closetrent_session';
/** Cookie holding the user's role for portal routing */
const ROLE_COOKIE = 'closetrent_role';

/** Routes that should redirect authenticated users away */
const AUTH_ONLY_PATHS = ['/login', '/register'];

/** Reserved subdomains that are NOT tenant stores */
const RESERVED_SUBDOMAINS = ['admin', 'www', 'api', 'cdn', 'mail'];

/**
 * Routes that are ALLOWED on the bare domain (no subdomain).
 * Everything else on bare domain gets blocked.
 */
const BARE_DOMAIN_ALLOWED_PATHS = [
  '/landing',
  '/login',
  '/register',
  '/admin',
];

/**
 * Routes that REQUIRE a tenant context (subdomain or custom domain).
 * If accessed on bare domain, the user is redirected to the landing page.
 */
const TENANT_ONLY_PREFIXES = [
  '/dashboard',
  '/products',
  '/cart',
  '/checkout',
  '/booking',
  '/category',
  '/store-suspended',
];

// ─────────────────────────────────────────────────────────────────────
// Subdomain Extraction
// ─────────────────────────────────────────────────────────────────────

function extractSubdomainFromHost(host: string): string | null {
  const hostname = host.split(':')[0];

  // Development: handle "subdomain.localhost"
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, -'.localhost'.length);
    return sub && !sub.includes('.') ? sub : null;
  }

  // Bare localhost or IP — no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Custom domain via hosts file (*.local) — treat as custom domain, not subdomain
  if (hostname.endsWith('.local')) {
    return null;
  }

  // Production: "subdomain.closetrent.com" (3+ parts)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

function isCustomDomainHost(host: string): boolean {
  const hostname = host.split(':')[0];

  // Dev: hosts file custom domain (e.g., rentbysara.local)
  if (hostname.endsWith('.local') && !hostname.endsWith('.localhost')) {
    return true;
  }

  // Not localhost/IP
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }

  // Production: 2-part domain that's not the platform itself
  const parts = hostname.split('.');
  if (parts.length === 2) {
    const platformDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com';
    return hostname !== platformDomain.split(':')[0];
  }

  return false;
}

/**
 * Check if a path is a tenant-only route that requires subdomain/custom domain.
 */
function isTenantOnlyPath(pathname: string): boolean {
  return TENANT_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Check if a path is allowed on the bare domain.
 */
function isBareDomainAllowed(pathname: string): boolean {
  if (pathname === '/') return true; // Will be rewritten to /landing
  return BARE_DOMAIN_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
}

// ─────────────────────────────────────────────────────────────────────
// Main Middleware
// ─────────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || 'localhost:3000';

  const subdomain = extractSubdomainFromHost(host);
  const customDomain = isCustomDomainHost(host);
  const isTenantContext = (!!subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) || customDomain;
  const isAdminSubdomain = subdomain === 'admin';
  const isBareDomain = !subdomain && !customDomain;

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const roleCookie = request.cookies.get(ROLE_COOKIE);
  const isAuthenticated = !!sessionCookie?.value;
  const userRole = roleCookie?.value;

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: DOMAIN-LEVEL ROUTING (before auth checks)
  // ═══════════════════════════════════════════════════════════════════

  // ── 1a. BARE DOMAIN — SaaS platform pages only ────────────────────
  if (isBareDomain) {
    // Root → landing page
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/landing';
      return NextResponse.rewrite(url);
    }

    // Block tenant-only routes on bare domain
    if (isTenantOnlyPath(pathname)) {
      // If they're trying to reach /dashboard and are authenticated,
      // give them a helpful redirect hint
      const url = new URL('/landing', request.url);
      url.searchParams.set('error', 'no_store');
      return NextResponse.redirect(url);
    }

    // Block any unknown paths that aren't explicitly allowed on bare domain
    // (e.g., someone navigating to localhost:3000/some-random-path)
    if (!isBareDomainAllowed(pathname)) {
      return NextResponse.redirect(new URL('/landing', request.url));
    }
  }

  // ── 1b. ADMIN SUBDOMAIN — admin portal only ───────────────────────
  if (isAdminSubdomain) {
    // Allow login/register on admin subdomain
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      // fall through to auth checks below
    }
    // Allow /admin paths
    else if (pathname.startsWith('/admin')) {
      // fall through to auth checks below
    }
    // Everything else → redirect to /admin
    else {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ── 1c. TENANT CONTEXT — storefront & owner portal ────────────────
  if (isTenantContext) {
    // /landing on tenant subdomain → redirect to storefront
    if (pathname === '/landing') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // /admin on tenant subdomain → wrong place, redirect
    if (pathname.startsWith('/admin')) {
      // Build the admin URL
      const hostname = host.split(':')[0];
      const port = host.includes(':') ? ':' + host.split(':')[1] : '';

      let adminUrl: string;
      if (hostname.endsWith('.localhost')) {
        adminUrl = `http://admin.localhost${port}/admin`;
      } else {
        const platformDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com';
        adminUrl = `${request.nextUrl.protocol}//admin.${platformDomain}/admin`;
      }

      return NextResponse.redirect(new URL(adminUrl));
    }

    // /register on tenant subdomain → redirect to bare domain register
    // (registration creates new stores, it happens on the main platform domain)
    if (pathname === '/register') {
      const hostname = host.split(':')[0];
      const port = host.includes(':') ? ':' + host.split(':')[1] : '';

      let registerUrl: string;
      if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
        registerUrl = `http://localhost${port}/register`;
      } else {
        const platformDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com';
        registerUrl = `${request.nextUrl.protocol}//${platformDomain}/register`;
      }

      return NextResponse.redirect(new URL(registerUrl));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: SET TENANT HEADERS (for downstream Server Components)
  // ═══════════════════════════════════════════════════════════════════

  const response = NextResponse.next();
  if (isTenantContext && subdomain) {
    response.headers.set('x-tenant-subdomain', subdomain);
  }
  if (customDomain) {
    response.headers.set('x-tenant-custom-domain', host.split(':')[0]);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: AUTHENTICATION GUARDS
  // ═══════════════════════════════════════════════════════════════════

  // ── 3a. Store suspension page ─────────────────────────────────────
  if (pathname.startsWith('/store-suspended')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // ── 3b. Redirect authenticated users away from auth pages ─────────
  if (isAuthenticated && AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    const fromParam = request.nextUrl.searchParams.get('from');
    if (!fromParam) {
      if (userRole === 'saas_admin') {
        // Admin → admin portal
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      if (isTenantContext) {
        // On tenant subdomain → owner dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      // On bare domain, authenticated non-admin → landing (they need their subdomain)
      return NextResponse.redirect(new URL('/landing', request.url));
    }
  }

  // ── 3c. Protect owner portal (/dashboard/*) ───────────────────────
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // SaaS admin accessing /dashboard without impersonation → redirect to /admin
    const isImpersonation = request.nextUrl.searchParams.get('impersonate') === 'true';
    if (userRole === 'saas_admin' && !isImpersonation) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ── 3d. Protect admin portal (/admin/*) ───────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Non-admin users cannot access /admin
    if (userRole && userRole !== 'saas_admin') {
      if (isTenantContext) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/landing', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static   (Next.js static files)
     * - _next/image    (Next.js image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - Public API routes and assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
