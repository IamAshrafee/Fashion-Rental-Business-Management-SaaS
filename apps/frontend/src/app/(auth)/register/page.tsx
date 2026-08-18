'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Gift, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { registerWithCredentials } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-error';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">Loading registration…</div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const searchParams = useSearchParams();

  // Marketing URL params: /register?plan=pro&promo=LAUNCH2026&ref=facebook
  const urlPlan = searchParams.get('plan');
  const urlPromo = searchParams.get('promo');
  const urlRef = searchParams.get('ref');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    subdomain: '',
    promoCode: urlPromo || '',
    planSlug: urlPlan || '',
    referralSource: urlRef || '',
  });
  const [isSubdomainEdited, setIsSubdomainEdited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPromo, setShowPromo] = useState(!!urlPromo);
  const [subdomainState, setSubdomainState] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle',
  );

  function update(field: string, value: string) {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // Auto-generate subdomain from businessName if not manually edited
      if (field === 'businessName' && !isSubdomainEdited) {
        newData.subdomain = value
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 30);
      }

      if (field === 'subdomain') {
        setIsSubdomainEdited(true);
        setSubdomainState('idle');
        newData.subdomain = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      }

      return newData;
    });
  }

  async function checkSubdomain() {
    if (formData.subdomain.length < 3) return;
    setSubdomainState('checking');
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: { available: boolean };
      }>('/auth/check-subdomain', { subdomain: formData.subdomain });
      setSubdomainState(response.data.data.available ? 'available' : 'taken');
    } catch {
      setSubdomainState('idle');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !formData.fullName ||
      !formData.phone ||
      !formData.password ||
      !formData.businessName ||
      !formData.subdomain
    ) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.fullName.length < 2) {
      toast.error('Full name must be at least 2 characters');
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(formData.phone.trim())) {
      toast.error('Phone must be a valid BD number (01X-XXXX-XXXX)');
      return;
    }
    if (formData.password.length < 8 || !/^(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      toast.error('Password must contain at least 8 chars, 1 uppercase, and 1 number');
      return;
    }
    if (formData.subdomain.length < 3 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(formData.subdomain)) {
      toast.error('Subdomain must be lowercase letters, numbers, and hyphens only');
      return;
    }

    if (subdomainState === 'taken') {
      toast.error('Choose an available store URL');
      return;
    }

    setIsLoading(true);
    try {
      // Clean payload — omit empty optional fields
      const payload: Record<string, string> = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        businessName: formData.businessName.trim(),
        subdomain: formData.subdomain,
      };
      if (formData.email) payload.email = formData.email.trim().toLowerCase();
      if (formData.promoCode) payload.promoCode = formData.promoCode.trim().toUpperCase();
      if (formData.planSlug) payload.planSlug = formData.planSlug.trim();
      if (formData.referralSource) payload.referralSource = formData.referralSource.trim();

      await registerWithCredentials(payload);
      toast.success('Account created! Redirecting to your store dashboard...');

      // Redirect to dashboard on the new subdomain
      const subdomain = formData.subdomain;
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Development: redirect to subdomain.localhost:3000/dashboard
        window.location.href = `http://${subdomain}.localhost${port}/dashboard`;
      } else {
        // Production: redirect to subdomain.closetrent.com/dashboard
        const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'closetrent.com';
        window.location.href = `${window.location.protocol}//${subdomain}.${baseDomain}/dashboard`;
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create Account</CardTitle>
        <CardDescription>Start managing your fashion rental business</CardDescription>
        {/* Show marketing badges from URL params */}
        {(urlPlan || urlPromo) && (
          <div className="flex items-center justify-center gap-2 mt-2">
            {urlPlan && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {urlPlan.charAt(0).toUpperCase() + urlPlan.slice(1)} Plan
              </Badge>
            )}
            {urlPromo && (
              <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                <Gift className="h-3 w-3" />
                Promo: {urlPromo}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              placeholder="Your full name"
              value={formData.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              placeholder="Your rental business name"
              value={formData.businessName}
              onChange={(e) => update('businessName', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdomain">Store URL (Subdomain) *</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="subdomain"
                placeholder="your-store"
                value={formData.subdomain}
                onChange={(e) => update('subdomain', e.target.value)}
                onBlur={checkSubdomain}
                disabled={isLoading}
                className="text-right"
                required
              />
              <span className="text-muted-foreground text-sm whitespace-nowrap">
                .closetrent.com
              </span>
            </div>
            {subdomainState === 'checking' && (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            )}
            {subdomainState === 'available' && (
              <p className="text-xs text-emerald-600">This store URL is available.</p>
            )}
            {subdomainState === 'taken' && (
              <p className="text-xs text-destructive">This store URL is already taken.</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="01XXXXXXXXX"
                value={formData.phone}
                onChange={(e) => update('phone', e.target.value)}
                disabled={isLoading}
                required
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => update('password', e.target.value)}
              disabled={isLoading}
            />
            <p className="text-[11px] text-muted-foreground">
              At least 8 chars, 1 uppercase, 1 number
            </p>
          </div>

          {/* Promo Code Field */}
          {!showPromo && !urlPromo ? (
            <button
              type="button"
              onClick={() => setShowPromo(true)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Gift className="h-3.5 w-3.5" />
              Have a promo code?
            </button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="promoCode">Promo Code</Label>
              <Input
                id="promoCode"
                placeholder="LAUNCH2026"
                value={formData.promoCode}
                onChange={(e) => update('promoCode', e.target.value.toUpperCase())}
                disabled={isLoading || !!urlPromo}
                className="uppercase tracking-wider"
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || subdomainState === 'checking' || subdomainState === 'taken'}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
            Sign In
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
