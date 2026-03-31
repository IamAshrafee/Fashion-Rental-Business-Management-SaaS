/**
 * Next.js Middleware — ClosetRent Frontend
 *
 * Provides a first-line of defense for route protection.
 * Since JWTs are stored in-memory (not cookies) on the client,
 * full auth validation must happen client-side via guards.
 *
 * This middleware handles:
 * 1. Blocks direct navigation to /admin/* routes for non-admins
 *    using a lightweight cookie-based hint set after login.
 * 2. Redirects /dashboard/* and /admin/* to /login when the
 *    `closetrent_session` cookie is absent (set by the backend
 *    as a non-httpOnly marker cookie alongside the httpOnly refresh token).
 * 3. Prevents authenticated users from seeing /login or /register.
 *
 * NOTE: The httpOnly refresh token cookie cannot be read here.
 * The backend MUST also set a non-sensitive `closetrent_session=1`
 * indicator cookie (non-httpOnly, SameSite=Lax) for middleware to use.
 * If this cookie is absent, the user is considered unauthenticated.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Marker cookie set by backend on login, cleared on logout */
const SESSION_COOKIE = 'closetrent_session';
/** Cookie holding the user's role for portal routing */
const ROLE_COOKIE = 'closetrent_role';

/** Routes that should redirect authenticated users away */
const AUTH_ONLY_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const roleCookie = request.cookies.get(ROLE_COOKIE);

  const isAuthenticated = !!sessionCookie?.value;
  const userRole = roleCookie?.value;

  // ── 1. Allow store-suspended page for authenticated owners ──────
  // Don't redirect to /dashboard — they need to see the suspension page.
  if (pathname.startsWith('/store-suspended')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // ── 2. Redirect authenticated users away from auth pages ──────────
  // But allow through if there's a ?from= param — the user may need to
  // re-authenticate and the login page will redirect them back.
  if (isAuthenticated && AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    const fromParam = request.nextUrl.searchParams.get('from');
    if (!fromParam) {
      const redirect = userRole === 'saas_admin' ? '/admin' : '/dashboard';
      return NextResponse.redirect(new URL(redirect, request.url));
    }
  }

  // ── 3. Protect owner portal (/dashboard/*) ────────────────────────
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Allow saas_admin through when impersonating a tenant
    const isImpersonation = request.nextUrl.searchParams.get('impersonate') === 'true';
    if (userRole === 'saas_admin' && !isImpersonation) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ── 4. Protect admin portal (/admin/*) ────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Non-admin users cannot access /admin
    if (userRole && userRole !== 'saas_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
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
