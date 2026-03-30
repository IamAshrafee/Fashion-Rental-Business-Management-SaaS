'use client';

import { useEffect, useState } from 'react';
import { setAccessToken, setTenantIdLocal } from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';
import { ShieldAlert, X } from 'lucide-react';

/**
 * Point 4: Impersonation token handler.
 * On mount, checks localStorage for an impersonation token set by the admin panel.
 * If found, consumes it (one-time use), sets it as the active access token,
 * and displays a banner.
 *
 * Point 24: Impersonation banner.
 * Shows a distinct UI bar at the top of the page when the admin is
 * impersonating a tenant, with an "Exit" button.
 */
export function ImpersonationHandler() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const { refreshUser } = useAuth();

  useEffect(() => {
    // Check if there's a pending impersonation from the admin panel
    const raw = localStorage.getItem('closetrent_impersonation');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      // Validate it's not stale (max 5 minutes old)
      if (Date.now() - data.timestamp > 5 * 60 * 1000) {
        localStorage.removeItem('closetrent_impersonation');
        return;
      }

      // Consume the impersonation token (one-time use)
      localStorage.removeItem('closetrent_impersonation');

      // Set the token and tenant in the auth system
      setAccessToken(data.token, data.expiresIn || 3600, data.tenantId);
      setTenantIdLocal(data.tenantId);

      // Mark the current session as impersonation
      sessionStorage.setItem('closetrent_is_impersonation', 'true');

      setIsImpersonating(true);

      // Refresh the user context with the impersonation token
      refreshUser();
    } catch {
      localStorage.removeItem('closetrent_impersonation');
    }
  }, [refreshUser]);

  // Also check on mount if we're already in an impersonation session
  useEffect(() => {
    if (sessionStorage.getItem('closetrent_is_impersonation') === 'true') {
      setIsImpersonating(true);
    }
  }, []);

  const handleExit = () => {
    sessionStorage.removeItem('closetrent_is_impersonation');
    setIsImpersonating(false);
    // Close this tab — the admin portal is in the original tab
    window.close();
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
