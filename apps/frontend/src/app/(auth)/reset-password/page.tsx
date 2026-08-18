'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { PasswordInput } from '@/components/ui/password-input';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading reset form…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const search = useSearchParams();
  const router = useRouter();
  const [identifier, setIdentifier] = useState(search.get('identifier') ?? '');
  const [token, setToken] = useState(search.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error('The password confirmation does not match.');
      return;
    }
    if (password.length < 8 || !/^(?=.*[A-Z])(?=.*\d)/.test(password)) {
      toast.error('Password must contain at least 8 chars, 1 uppercase, and 1 number');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', {
        identifier: identifier.trim().toLowerCase(),
        token: token.trim(),
        newPassword: password,
      });
      setComplete(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'The reset link is invalid or has expired.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (complete) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <div>
            <h2 className="font-semibold">Password updated</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every existing session was signed out for your security.
            </p>
          </div>
          <Button className="w-full" onClick={() => router.replace('/login')}>
            Sign in with the new password
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          The reset link can be used once and expires after one hour.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="reset-account">Phone or email</Label>
            <Input
              id="reset-account"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
              readOnly={!!search.get('identifier')}
              className={search.get('identifier') ? 'bg-muted' : ''}
            />
          </div>
          {!search.get('token') && (
            <div className="space-y-2">
              <Label htmlFor="reset-token">Reset token</Label>
              <Input
                id="reset-token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              showStrengthIndicator
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
