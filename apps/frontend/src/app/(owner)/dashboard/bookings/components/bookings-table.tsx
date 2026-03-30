'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, Maximize2, Search, CheckCircle, Package, MoreHorizontal } from 'lucide-react';
import { BookingStatus } from '../types';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Flexible row type that works with both API responses and legacy types
interface BookingRow {
  id: string;
  bookingNumber?: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  grandTotal: number;
  createdAt: string;
  customer: { id?: string; name?: string; fullName?: string; phone: string; email?: string };
  items: Array<Record<string, unknown>>;
}

// Status badge mapping based on UI spec
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  let label = status.charAt(0).toUpperCase() + status.slice(1);
  let colorClass = '';
  
  switch (status) {
    case 'pending': colorClass = 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'; break;
    case 'confirmed': colorClass = 'bg-blue-100 text-blue-800 hover:bg-blue-200'; break;
    case 'shipped': colorClass = 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'; break;
    case 'delivered': colorClass = 'bg-teal-100 text-teal-800 hover:bg-teal-200'; break;
    case 'overdue': colorClass = 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200 font-bold'; label = 'Overdue ⚠️'; break;
    case 'returned': colorClass = 'bg-purple-100 text-purple-800 hover:bg-purple-200'; break;
    case 'inspected': colorClass = 'bg-orange-100 text-orange-800 hover:bg-orange-200'; break;
    case 'completed': colorClass = 'bg-green-100 text-green-800 hover:bg-green-200'; label = 'Completed ✅'; break;
    case 'cancelled': colorClass = 'bg-gray-100 text-gray-800 hover:bg-gray-200'; break;
  }

  return (
    <Badge variant="outline" className={cn("inline-flex items-center shadow-none", colorClass)}>
      {label}
    </Badge>
  );
}

export const columns: ColumnDef<BookingRow>[] = [
  {
    id: 'bookingNumber',
    accessorFn: (row) => row.bookingNumber || row.orderNumber || '',
    header: 'Booking #',
    cell: ({ row }) => {
      const b = row.original;
      const displayNumber = b.bookingNumber || b.orderNumber || b.id;
      return (
        <Link href={`/dashboard/bookings/${b.id}`} className="font-medium hover:underline flex items-center gap-1">
          {displayNumber}
        </Link>
      );
    },
  },
  {
    accessorFn: (row) => row.customer.fullName || row.customer.name || '',
    id: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.customer.fullName || row.original.customer.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.customer.phone}</span>
      </div>
    ),
  },
  {
    id: 'items',
    header: 'Items',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.items.length} item(s)</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <BookingStatusBadge status={row.original.status as BookingStatus} />,
  },
  {
    accessorKey: 'grandTotal',
    header: () => <div className="text-right">Total (৳)</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('grandTotal'));
      const isPaid = row.original.paymentStatus === 'paid';
      return (
        <div className="flex flex-col items-end">
          <span className="font-medium">{amount.toLocaleString()}</span>
          <span className="text-[10px] uppercase text-muted-foreground flex items-center">
            {isPaid ? <span className="text-green-600 font-semibold inline-flex items-center"><CheckCircle className="h-3 w-3 mr-1" />Paid</span> : row.original.paymentStatus}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return (
        <div className="text-right flex items-center justify-end">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-mr-4 h-8"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const dateStr = row.getValue('createdAt') as string;
      const date = parseISO(dateStr);
      return (
        <div className="text-right flex flex-col text-sm">
          <span>{format(date, 'MMM d, yyyy')}</span>
          <span className="text-xs text-muted-foreground">{format(date, 'h:mm a')}</span>
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const booking = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/bookings/${booking.id}`}>
                <Maximize2 className="mr-2 h-4 w-4" /> View Detail
              </Link>
            </DropdownMenuItem>
            {booking.status === 'confirmed' && (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/bookings/${booking.id}?action=ship`}>
                  <Package className="mr-2 h-4 w-4" /> Ship Order
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface BookingsDataTableProps {
  data: BookingRow[];
  activeStatus: string;
  onStatusChange: (status: string) => void;
  searchValue: string;
  onSearchChange: (search: string) => void;
}

export function BookingsDataTable({
  data,
  activeStatus,
  onStatusChange,
  searchValue,
  onSearchChange,
}: BookingsDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  
  // Debounced search — waits 400ms after user stops typing
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const [localSearch, setLocalSearch] = React.useState(searchValue);

  const handleSearchInput = (value: string) => {
    setLocalSearch(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 400);
  };

  // Data is already filtered server-side, no need for client-side filtering

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  // Tab counts are approximate from the current dataset
  // (in the future, fetch counts from a separate server endpoint)
  const getCount = (status: string) => {
    if (status === 'all') return data.length;
    return data.filter(d => d.status === status).length;
  };

  const TABS: Array<{ value: string, label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'returned', label: 'Returned' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search booking # or customer..."
            value={localSearch}
            onChange={(event) => handleSearchInput(event.target.value)}
            className="pl-8 bg-background"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs 
        value={activeStatus} 
        onValueChange={onStatusChange}
        className="w-full"
      >
        <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
          <TabsList className="bg-transparent space-x-2 h-10 w-max p-0 border-b min-w-full justify-start rounded-none">
            {TABS.map(tab => {
              const count = getCount(tab.value);
              return (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 font-medium"
                >
                  {tab.label}
                  {activeStatus === tab.value || tab.value === 'all' ? (
                    <span className="ml-2 text-xs text-muted-foreground">({count})</span>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      </Tabs>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="first:pl-4">
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
              table.getRowModel().rows.map((row) => {
                // Determine left border color accent based on status
                const status = row.original.status;
                let borderAccent = 'border-l-transparent';
                if (status === 'pending') borderAccent = 'border-l-yellow-400';
                if (status === 'confirmed') borderAccent = 'border-l-blue-400';
                if (status === 'overdue') borderAccent = 'border-l-red-500 bg-red-50/20';

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn("border-l-4 transition-colors", borderAccent)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="first:pl-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Package className="h-8 w-8 mb-2 opacity-30" />
                    <span>No bookings found.</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {data.length} records.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
