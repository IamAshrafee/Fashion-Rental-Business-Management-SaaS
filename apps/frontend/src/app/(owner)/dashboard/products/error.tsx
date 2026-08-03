'use client';

import { OwnerListError } from '@/components/owner/workspace';

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <OwnerListError message={error.message || 'The product catalog could not be loaded.'} onRetry={reset} />;
}
