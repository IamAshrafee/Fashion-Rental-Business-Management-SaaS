'use client';

import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { TrashDataTable, TrashedProductRow } from '../components/product-list/trash-data-table';

const MOCK_TRASH: TrashedProductRow[] = [
  {
    id: 'prod_99',
    name: 'Old Summer Dress',
    deletedAt: '2025-11-01',
    deletedBy: 'Admin User',
  },
];

export default function TrashPage() {
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
            title="Trash"
            description="Manage soft-deleted products"
          />
        </div>
      </div>

      <div className="bg-card text-card-foreground">
        <TrashDataTable data={MOCK_TRASH} />
      </div>
    </div>
  );
}
