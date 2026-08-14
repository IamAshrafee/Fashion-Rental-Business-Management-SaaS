import Link from 'next/link';
import { ArrowRight, CheckCircle2, PackagePlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProductSetupCompletePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { status?: string };
}) {
  const published = searchParams.status === 'published';
  const registrationHref = `/dashboard/inventory/items/register?productId=${encodeURIComponent(params.id)}&returnTo=${encodeURIComponent(`/dashboard/products/${params.id}`)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Card>
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <CardTitle className="text-2xl">
            {published ? 'Product published' : 'Product draft saved'}
          </CardTitle>
          <CardDescription>
            The catalog listing is complete. Physical inventory is registered separately so every
            rentable piece receives its own asset identity, location, condition, and acquisition history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button className="h-auto justify-between py-4 sm:col-span-2" asChild>
            <Link href={registrationHref}>
              <span className="flex items-center gap-3">
                <PackagePlus className="size-5" />
                <span className="text-left">
                  <span className="block">Add physical items now</span>
                  <span className="block text-xs font-normal opacity-80">
                    The product is preselected; choose a SKU and register exact pieces.
                  </span>
                </span>
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/products/${params.id}`}>View product</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/products/new"><Plus className="mr-2 size-4" />Create another product</Link>
          </Button>
          <Button variant="ghost" className="sm:col-span-2" asChild>
            <Link href="/dashboard/products">Go to catalog</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
