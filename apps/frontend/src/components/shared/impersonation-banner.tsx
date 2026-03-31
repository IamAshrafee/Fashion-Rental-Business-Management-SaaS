'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';

/**
 * ImpersonationBanner — displays a sticky amber banner when an admin
 * is impersonating a tenant owner. Rendered inside OwnerGuard children
 * (only visible after auth is settled).
 *
 * Reads sessionStorage('closetrent_is_impersonation') to determine state.
 * The "Exit" button clears impersonation state, restores admin cookies,
 * and closes/redirects the tab.
 */
export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('closetrent_is_impersonation') === 'true') {
      setIsImpersonating(true);
    }
  }, []);

  const handleExit = () => {
    // Clear impersonation markers
    sessionStorage.removeItem('closetrent_is_impersonation');
    sessionStorage.removeItem('closetrent_impersonation_token');
    sessionStorage.removeItem('closetrent_impersonation_tenant');
    sessionStorage.removeItem('closetrent_impersonation_expires');

    // Restore admin role cookie so middleware routes correctly
    const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
    document.cookie = `closetrent_role=saas_admin; Max-Age=${REFRESH_MAX_AGE}; path=/; SameSite=Lax`;

    setIsImpersonating(false);

    // Try to close tab (works when opened via window.open)
    // Fallback: redirect to admin portal after a short delay
    window.close();
    setTimeout(() => {
      window.location.href = '/admin';
    }, 500);
  };

  if (!isImpersonating) return null;

  return (
    <div className="sticky top-0 z-[100] flex items-center justify-between gap-3 bg-amber-500 dark:bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Admin Impersonation Active — You are viewing this tenant as an owner.
          Actions are logged.
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
      >
        <X className="h-3 w-3" />
        Exit Impersonation
      </button>
    </div>
  );
}
