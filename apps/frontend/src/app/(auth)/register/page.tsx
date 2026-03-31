'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Gift, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
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
        newData.subdomain = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      }

      return newData;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.fullName || !formData.password || !formData.businessName || !formData.subdomain) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Clean payload — omit empty optional fields
      const payload: Record<string, string> = {
        fullName: formData.fullName,
        password: formData.password,
        businessName: formData.businessName,
        subdomain: formData.subdomain,
      };
      if (formData.email) payload.email = formData.email;
      if (formData.phone) payload.phone = formData.phone;
      if (formData.promoCode) payload.promoCode = formData.promoCode.toUpperCase();
      if (formData.planSlug) payload.planSlug = formData.planSlug;
      if (formData.referralSource) payload.referralSource = formData.referralSource;

      await apiClient.post('/auth/register', payload);
      toast.success('Account created! Please sign in.');
      router.push('/login');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Registration failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create Account</CardTitle>
        <CardDescription>
          Start managing your fashion rental business
        </CardDescription>
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
                disabled={isLoading}
                className="text-right"
              />
              <span className="text-muted-foreground text-sm whitespace-nowrap">.closetrent.com</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="01XXXXXXXXX"
                value={formData.phone}
                onChange={(e) => update('phone', e.target.value)}
                disabled={isLoading}
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a
            href="/login"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Sign In
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
