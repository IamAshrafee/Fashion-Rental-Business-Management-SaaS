'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { RefreshCw, Trash, Loader2, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useRestoreProduct, usePermanentDeleteProduct } from '../../hooks/use-product-apis';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrashedProductRow = {
  id: string;
  name: string;
  category?: string;
  deletedAt: string;
  deletedBy?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function daysInTrash(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  } catch {
    return '—';
  }
}

// ─── Restore Cell ─────────────────────────────────────────────────────────────

function RestoreAction({ product }: { product: TrashedProductRow }) {
  const [open, setOpen] = React.useState(false);
  const restore = useRestoreProduct();

  const handleRestore = () => {
    restore.mutate(product.id, { onSettled: () => setOpen(false) });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={restore.isPending}
      >
        {restore.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Restore
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&ldquo;{product.name}&rdquo;</strong> will be moved back to{' '}
              <span className="font-medium text-foreground">Draft</span> status. Review its pricing
              and images, then publish it when it&apos;s ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restore.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restore.isPending}>
              {restore.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restoring…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Restore</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Permanent Delete Cell ────────────────────────────────────────────────────

function PermanentDeleteAction({ product }: { product: TrashedProductRow }) {
  const [open, setOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const permanentDelete = usePermanentDeleteProduct();

  const handleDelete = () => {
    permanentDelete.mutate(product.id, {
      onSettled: () => {
        setOpen(false);
        setConfirmed(false);
      },
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setConfirmed(false); // reset checkbox when closed
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={permanentDelete.isPending}
      >
        {permanentDelete.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Trash className="h-4 w-4 mr-2" />
        )}
        Delete Forever
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Permanently Delete?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to permanently delete{' '}
                  <strong>&ldquo;{product.name}&rdquo;</strong>. This action{' '}
                  <span className="font-semibold text-destructive">cannot be undone</span>.
                </p>
                <p className="text-sm">
                  All data will be erased — variants, images, pricing, FAQs, and booking history
                  snapshots. Products with active bookings cannot be permanently deleted.
                </p>
                <div className="flex items-center gap-3 pt-1 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <Checkbox
                    id="confirm-permanent-delete"
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(!!v)}
                  />
                  <label
                    htmlFor="confirm-permanent-delete"
                    className="text-sm cursor-pointer select-none"
                  >
                    I understand this is permanent and cannot be undone
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDelete.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!confirmed || permanentDelete.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50"
            >
              {permanentDelete.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</>
              ) : (
                <><Trash className="h-4 w-4 mr-2" />Delete Forever</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export const columns: ColumnDef<TrashedProductRow>[] = [
  {
    accessorKey: 'name',
    header: 'Product Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.getValue('category') || '—'}</div>
    ),
  },
  {
    accessorKey: 'deletedAt',
    header: 'Deleted On',
    cell: ({ row }) => {
      const iso = row.getValue('deletedAt') as string;
      return <div className="text-muted-foreground">{formatDate(iso)}</div>;
    },
  },
  {
    id: 'daysInTrash',
    header: () => (
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4" /> In Trash For
      </div>
    ),
    cell: ({ row }) => {
      const iso = row.getValue('deletedAt') as string;
      const days = daysInTrash(iso);
      return (
        <Badge variant="outline" className="font-normal text-amber-600 border-amber-300">
          {days}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'deletedBy',
    header: 'Deleted By',
    cell: ({ row }) => (
      <div className="text-muted-foreground text-sm">
        {row.getValue('deletedBy') || '—'}
      </div>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex justify-end gap-2">
          <RestoreAction product={product} />
          <PermanentDeleteAction product={product} />
        </div>
      );
    },
  },
];

// ─── TrashDataTable Component ─────────────────────────────────────────────────

export function TrashDataTable({
  data,
  totalCount,
  page,
  onPageChange,
}: {
  data: TrashedProductRow[];
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / 20),
  });

  return (
    <div className="w-full space-y-3">
      {totalCount > 0 && (
        <div className="text-sm text-muted-foreground px-1">
          {totalCount} item{totalCount !== 1 ? 's' : ''} in trash
        </div>
      )}

      <div className="rounded-md border bg-card text-card-foreground">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Trash className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Trash is empty</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalCount > 20 && (
        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(totalCount / 20)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= Math.ceil(totalCount / 20)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
