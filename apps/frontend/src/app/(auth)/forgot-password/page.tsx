'use client';

import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = identifier.trim();
    if (!normalized) return;
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { identifier: normalized });
      setSubmitted(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'The reset request could not be submitted.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>Enter the phone number or email attached to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-4 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              If that account exists, reset instructions have been sent. The link expires in one
              hour.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="/login">Return to sign in</a>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="reset-identifier">Phone or email</Label>
              <Input
                id="reset-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="01XXXXXXXXX or you@example.com"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset instructions
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Remembered it?{' '}
              <a href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </a>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
