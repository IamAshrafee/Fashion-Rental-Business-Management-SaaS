'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { staffApi } from '@/lib/api/staff';

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token)
      return setError('This invitation link is incomplete. Ask the store owner for a new link.');
    if (password.length < 10) return setError('Use at least 10 characters for your password.');
    if (password !== confirmation) return setError('The passwords do not match.');
    setSubmitting(true);
    try {
      await staffApi.acceptInvitation({ token, password });
      setAccepted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This invitation could not be accepted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (accepted)
    return (
      <div className="mx-auto max-w-md space-y-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-semibold">Your account is ready</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with the phone number or email from your invitation and the password you just
            chose.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <KeyRound className="mb-4 h-9 w-9 text-primary" />
        <h1 className="text-2xl font-semibold">Join the store team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a private password. If you already use this contact on ClosetRent, enter your current password.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">Confirm password</Label>
          <Input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Accept invitation'}
        </Button>
      </form>
    </div>
  );
}

export default function AcceptStaffInvitationPage() {
  return (
    <main className="min-h-[70vh] px-4 py-16">
      <Suspense
        fallback={<div className="mx-auto h-80 max-w-md animate-pulse rounded-2xl bg-muted" />}
      >
        <AcceptInvitationForm />
      </Suspense>
    </main>
  );
}
