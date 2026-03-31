'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { loginWithCredentials } from '@/lib/auth';

/** Determine the portal URL based on authenticated user role and redirect param */
function getPostLoginRedirect(role: string | undefined, fromPath: string | null): string {
  if (role === 'saas_admin') return '/admin';
  if (fromPath && fromPath.startsWith('/') && !fromPath.startsWith('/login')) {
    return fromPath;
  }
  return '/dashboard'; // owner | manager | staff | unknown
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, refreshUser } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If user is already authenticated (e.g. arrived via ?from= redirect),
  // send them to the intended destination instead of showing the login form.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const fromPath = new URLSearchParams(window.location.search).get('from');
    router.replace(getPostLoginRedirect(user?.role, fromPath));
  }, [authLoading, isAuthenticated, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOrPhone || !password) {
      toast.error('Please enter your email/phone and password');
      return;
    }

    setIsLoading(true);
    try {
      // Call login directly so we get the user object back with their role
      const user = await loginWithCredentials(emailOrPhone, password);

      // Scenario B: all tenants are suspended → redirect BEFORE syncing auth
      // context. If we call refreshUser() first, it sets isAuthenticated=true
      // which triggers the useEffect redirect to /dashboard, causing a flash.
      if (!user.tenantId && user.suspendedTenants && user.suspendedTenants.length > 0) {
        const suspended = user.suspendedTenants[0];
        const storeName = suspended?.businessName || '';
        const reason = suspended?.statusReason || '';
        const params = new URLSearchParams({ store: storeName });
        if (reason) params.set('reason', reason);
        router.push(`/store-suspended?${params.toString()}`);
        return;
      }

      // Sync the auth context with the new session (only for active tenants)
      await refreshUser();
      toast.success('Welcome back!');
      const fromPath = new URLSearchParams(window.location.search).get('from');
      router.push(getPostLoginRedirect(user.role, fromPath));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Invalid credentials';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }
  // Don't flash the login form while checking auth or auto-redirecting
  if (authLoading || isAuthenticated) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign In</CardTitle>
        <CardDescription>
          Enter your credentials to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email or Phone</Label>
            <Input
              id="login-email"
              type="text"
              placeholder="you@example.com or 01XXXXXXXXX"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a
            href="/register"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Register
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
