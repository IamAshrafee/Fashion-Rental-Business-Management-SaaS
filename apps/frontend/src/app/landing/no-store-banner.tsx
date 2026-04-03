'use client';

import { useSearchParams } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { useState, Suspense } from 'react';

function NoStoreBannerInner() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const error = searchParams.get('error');
  if (error !== 'no_store' || dismissed) return null;

  return (
    <div className="relative border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">
            No store found on this domain
          </p>
          <p className="mt-0.5 text-sm text-amber-700">
            You tried to access a store page, but this is the main ClosetRent platform.
            To access your store, use your subdomain:{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">
              yourstore.localhost:3000
            </code>
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-1 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Wrapper with Suspense boundary — useSearchParams requires it in Next.js App Router.
 */
export function NoStoreBanner() {
  return (
    <Suspense fallback={null}>
      <NoStoreBannerInner />
    </Suspense>
  );
}
