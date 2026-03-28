'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import apiClient from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    subdomain: '',
  });
  const [isSubdomainEdited, setIsSubdomainEdited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
        // Clean manually entered subdomain
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
      await apiClient.post('/auth/register', formData);
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
