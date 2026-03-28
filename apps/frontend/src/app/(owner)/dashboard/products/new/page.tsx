'use client';

import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { ProductFormWizard } from '../components/product-form';

export default function AddProductPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/products">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back to products</span>
          </Link>
        </Button>
        <PageHeader
          title="Add Product"
          description="Create a new rental listing"
        />
      </div>

      <div className="rounded-md bg-card text-muted-foreground">
        <ProductFormWizard />
      </div>
    </div>
  );
}
