import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RegistrationForm } from './registration-form';

function safeReturnTo(value: string | undefined) {
  if (!value?.startsWith('/dashboard/') || value.startsWith('//')) {
    return '/dashboard/inventory/items';
  }
  return value;
}

export default function RegisterPhysicalItemsPage({
  searchParams,
}: {
  searchParams: { productId?: string; variantSizeId?: string; returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams.returnTo);
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-3" asChild>
          <Link href={returnTo}><ArrowLeft className="mr-2 size-4" />Back</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Register physical items</h1>
        <p className="text-sm text-muted-foreground">
          Create permanent identities for the exact pieces your business owns. The complete batch is
          validated and registered together, or nothing is created.
        </p>
      </div>
      <RegistrationForm
        initialProductId={searchParams.productId}
        initialVariantSizeId={searchParams.variantSizeId}
        returnTo={returnTo}
      />
    </div>
  );
}
