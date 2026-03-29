'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { TrashDataTable, type TrashedProductRow } from '../components/product-list/trash-data-table';
import { productApi } from '@/lib/api/products';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TrashPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['products', 'trash'],
    queryFn: () => productApi.listTrash({ limit: 50 }),
  });

  const trashItems: TrashedProductRow[] = (data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    deletedAt: p.deletedAt ?? p.updatedAt ?? p.createdAt,
    deletedBy: 'System',
  }));

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

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load trash. {(error as Error)?.message || 'Please try again.'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="bg-card text-card-foreground">
          <TrashDataTable data={trashItems} />
        </div>
      )}
    </div>
  );
}
