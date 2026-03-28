'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, RefreshCw, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export type TrashedProductRow = {
  id: string;
  name: string;
  deletedAt: string;
  deletedBy: string;
};

// --- Columns Definition ---
export const columns: ColumnDef<TrashedProductRow>[] = [
  {
    accessorKey: 'name',
    header: 'Product Name',
    cell: ({ row }) => (
      <div className="font-medium text-muted-foreground">
        {row.getValue('name')}
      </div>
    ),
  },
  {
    accessorKey: 'deletedAt',
    header: 'Deleted At',
  },
  {
    accessorKey: 'deletedBy',
    header: 'Deleted By',
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex justify-end gap-2 text-right">
          <Button variant="outline" size="sm" onClick={() => toast.success(`Restored ${product.name}`)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Restore
          </Button>
          <Button variant="destructive" size="sm" onClick={() => toast.success(`Permanently deleted ${product.name}`)}>
            <Trash className="h-4 w-4 mr-2" />
            Delete Forever
          </Button>
        </div>
      );
    },
  },
];

export function TrashDataTable({ data }: { data: TrashedProductRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full">
      <div className="rounded-md border bg-card text-card-foreground">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Trash is empty.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
