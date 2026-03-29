'use client';

import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EditProductForm } from '../../components/product-form/edit-product-form';

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/products/${id}`}>
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back to product</span>
          </Link>
        </Button>
        <PageHeader
          title="Edit Product"
          description="Update listing details, pricing, and media"
        />
      </div>

      <div className="rounded-md bg-card text-muted-foreground w-full">
        <EditProductForm productId={id} />
      </div>
    </div>
  );
}
