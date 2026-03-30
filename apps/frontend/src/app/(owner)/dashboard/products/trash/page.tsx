'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { TrashDataTable, type TrashedProductRow } from '../components/product-list/trash-data-table';
import { productApi } from '@/lib/api/products';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PAGE_SIZE = 20;

export default function TrashPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['products', 'trash', page],
    queryFn: () => productApi.listTrash({ page, limit: PAGE_SIZE }),
    // Keep previous data visible while loading next page
    placeholderData: (prev) => prev,
  });

  const trashItems: TrashedProductRow[] = (data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: (p as any).category?.name ?? undefined,
    deletedAt: p.deletedAt ?? p.updatedAt ?? p.createdAt,
    deletedBy: (p as any).deletedBy?.fullName ?? undefined,
  }));

  const totalCount = data?.meta?.total ?? 0;

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
            description="Soft-deleted products — restore or permanently delete"
          />
        </div>

        {/* Item count badge in header area */}
        {!isLoading && totalCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-md px-3 py-1.5">
            <Trash2 className="h-4 w-4" />
            <span>{totalCount} item{totalCount !== 1 ? 's' : ''} in trash</span>
          </div>
        )}
      </div>

      {/* Info banner about auto-purge */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <strong>Auto-purge: </strong>Products in trash for more than 90 days are permanently
        deleted automatically every Sunday. Restore anything you want to keep.
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
          <TrashDataTable
            data={trashItems}
            totalCount={totalCount}
            page={page}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
