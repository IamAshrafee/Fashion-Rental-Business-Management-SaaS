'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export function LandingNavbarActions() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const subdomain = user?.subdomain || (user as any)?.currentTenant?.subdomain;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 w-[150px] justify-end">
         <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const isAdmin = user.role === 'saas_admin';
    
    let targetUrl = '/dashboard';
    if (isAdmin) {
      targetUrl = '/admin';
    } else if (subdomain) {
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
      const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
      const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com';
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      
      if (!currentHost.includes(subdomain)) {
        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
          targetUrl = `${protocol}//${subdomain}.localhost${port}/dashboard`;
        } else {
          targetUrl = `${protocol}//${subdomain}.${baseDomain}/dashboard`;
        }
      }
    }
    
    return (
      <div className="flex items-center gap-3">
        <Link
          href={targetUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
        >
          {isAdmin ? 'Admin Portal' : 'Go to Dashboard'} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        Sign In
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
      >
        Get Started <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
