'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldOff, LogOut, RefreshCw, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { refreshAccessToken } from '@/lib/auth';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

function StoreSuspendedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser, logout } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const storeName = searchParams.get('store') || 'Your store';
  const reason = searchParams.get('reason');

  async function handleTryAgain() {
    setIsRetrying(true);
    try {
      // 1. Force a token refresh — the backend now re-resolves the tenantId
      // from the database when the current JWT has tenantId=null. If the
      // tenant has been reactivated, the new JWT will include the tenantId.
      const newToken = await refreshAccessToken();
      if (!newToken) {
        toast.error('Session expired. Please log in again.');
        await logout();
        router.push('/login');
        return;
      }

      // 2. Verify the tenant is now active via /auth/me
      const response = await apiClient.get<{
        success: boolean;
        data: { currentTenant?: { id: string; status: string } | null };
      }>('/auth/me');

      const tenant = response.data?.data?.currentTenant;
      if (tenant?.id) {
        // Tenant is active — sync auth context, then redirect
        await refreshUser();
        toast.success('Your store has been reactivated!');
        router.push('/dashboard');
      } else {
        toast.error('Your store is still suspended. Please contact support.');
      }
    } catch {
      toast.error('Your store is still suspended. Please contact support.');
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch {
      // Even if the API call fails, clear local state and redirect
      router.push('/login');
    }
  }

  return (
    <div className="w-full max-w-lg">
      <Card className="border-destructive/20 shadow-lg">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Store Suspended</CardTitle>
          <CardDescription className="mt-2 text-base">
            <span className="font-medium text-foreground">{storeName}</span>{' '}
            has been temporarily suspended by the platform administrator.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Suspension Reason — shown prominently when provided */}
          {reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive mb-1">Reason for Suspension</p>
              <p className="text-sm text-foreground">{reason}</p>
            </div>
          )}

          {/* Generic explanation — shown when no specific reason */}
          {!reason && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p>
                This may be due to a policy violation, billing issue, or
                administrative review. Your data is safe and will be available
                once the suspension is lifted.
            </p>
          </div>
          )}

          {/* Contact Support */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-sm">Contact Support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If you believe this is a mistake or need more information,
                  please reach out to our support team.
                </p>
                <a
                  href="mailto:support@closetrent.com"
                  className="mt-2 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  support@closetrent.com
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="default"
              className="flex-1"
              onClick={handleTryAgain}
              disabled={isRetrying || isLoggingOut}
            >
              {isRetrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Try Again
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleLogout}
              disabled={isRetrying || isLoggingOut}
            >
              {isLoggingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Log Out
            </Button>
          </div>

          {/* Subtle footer text */}
          <p className="text-center text-xs text-muted-foreground">
            If your store has been reactivated, click &quot;Try Again&quot; to
            return to your dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StoreSuspendedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
        </div>
      }
    >
      <StoreSuspendedContent />
    </Suspense>
  );
}
