'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { ProductTypeManager } from '../components/product-type-manager';

export default function ProductTypesPage() {
  const [addTrigger, setAddTrigger] = useState(false);
  const handleAddHandled = useCallback(() => setAddTrigger(false), []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/products">
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Back to products</span>
            </Link>
          </Button>
          <PageHeader
            title="Product Types"
            description="Manage product types and their default sizing schemas"
          />
        </div>
        <Button onClick={() => setAddTrigger(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product Type
        </Button>
      </div>

      <div className="bg-card text-card-foreground">
        <ProductTypeManager
          onAddClick={addTrigger}
          onAddHandled={handleAddHandled}
        />
      </div>
    </div>
  );
}
