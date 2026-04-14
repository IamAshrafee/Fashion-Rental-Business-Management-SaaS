'use client';

import * as React from 'react';
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowUpDown,
  Maximize2,
  Search,
  CheckCircle,
  Package,
  MoreHorizontal,
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { BookingStatus } from '../types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PaginationMeta } from '@closetrent/types';

// ─── Row Type ─────────────────────────────────────────────────────────────────

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

// ─── Status Badge ─────────────────────────────────────────────────────────────

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  let label = status.charAt(0).toUpperCase() + status.slice(1);
  let colorClass = '';
  
  switch (status) {
    case 'pending': colorClass = 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'; break;
    case 'confirmed': colorClass = 'bg-blue-100 text-blue-800 hover:bg-blue-200'; break;
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

// ─── Columns ──────────────────────────────────────────────────────────────────

export const columns: ColumnDef<BookingRow>[] = [
  {
    id: 'bookingNumber',
    accessorFn: (row) => row.bookingNumber || row.orderNumber || '',
    header: 'Booking #',
    cell: ({ row }) => {
      const b = row.original;
      const displayNumber = b.bookingNumber || b.orderNumber || b.id;
      return (
        <Link
          href={`/dashboard/bookings/${b.id}`}
          className="font-medium hover:underline flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
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
        <div onClick={(e) => e.stopPropagation()}>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

// ─── Status Tabs ──────────────────────────────────────────────────────────────

const TABS: Array<{ value: string, label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'returned', label: 'Returned' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingsDataTableProps {
  data: BookingRow[];
  meta?: PaginationMeta;
  activeStatus: string;
  onStatusChange: (status: string) => void;
  searchValue: string;
  onSearchChange: (search: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange: (dateFrom?: string, dateTo?: string) => void;
  paymentStatus?: string;
  onPaymentStatusChange: (paymentStatus?: string) => void;
  isFetching?: boolean;
}

export function BookingsDataTable({
  data,
  meta,
  activeStatus,
  onStatusChange,
  searchValue,
  onSearchChange,
  currentPage,
  onPageChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  paymentStatus,
  onPaymentStatusChange,
  isFetching,
}: BookingsDataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }]);
  
  // Responsive column visibility — hide Items and Date on mobile
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const updateVisibility = (e: MediaQueryListEvent | MediaQueryList) => {
      setColumnVisibility({
        items: !e.matches,
        createdAt: !e.matches,
      });
    };
    updateVisibility(mql);
    mql.addEventListener('change', updateVisibility);
    return () => mql.removeEventListener('change', updateVisibility);
  }, []);

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

  // Date range local state
  const [localDateFrom, setLocalDateFrom] = React.useState(dateFrom || '');
  const [localDateTo, setLocalDateTo] = React.useState(dateTo || '');

  const handleApplyDateRange = () => {
    onDateRangeChange(localDateFrom || undefined, localDateTo || undefined);
  };

  const handleClearDateRange = () => {
    setLocalDateFrom('');
    setLocalDateTo('');
    onDateRangeChange(undefined, undefined);
  };

  const hasDateFilter = !!(dateFrom || dateTo);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    pageCount: meta?.totalPages ?? -1,
    state: {
      sorting,
      columnVisibility,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: meta?.limit ?? 20,
      },
    },
  });

  // Derive active tab label for empty state
  const activeTabLabel = TABS.find(t => t.value === activeStatus)?.label?.toLowerCase() ?? '';

  // Pagination helpers
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? data.length;
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="w-full space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search booking #, customer name, phone..."
            value={localSearch}
            onChange={(event) => handleSearchInput(event.target.value)}
            className="pl-8 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Payment Status Filter */}
          <Select
            value={paymentStatus || 'all'}
            onValueChange={(val) => onPaymentStatusChange(val === 'all' ? undefined : val)}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={hasDateFilter ? 'default' : 'outline'}
                size="sm"
                className="h-9 gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {hasDateFilter ? 'Date filtered' : 'Date range'}
                {hasDateFilter && (
                  <X
                    className="h-3 w-3 ml-1 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearDateRange();
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium">Filter by date</p>
                <div className="flex gap-2 items-center">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <Input
                      type="date"
                      value={localDateFrom}
                      onChange={(e) => setLocalDateFrom(e.target.value)}
                      className="h-8 text-sm w-[150px]"
                    />
                  </div>
                  <span className="text-muted-foreground mt-5">–</span>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <Input
                      type="date"
                      value={localDateTo}
                      onChange={(e) => setLocalDateTo(e.target.value)}
                      className="h-8 text-sm w-[150px]"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={handleClearDateRange}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleApplyDateRange}>
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
            {TABS.map(tab => (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 font-medium"
              >
                {tab.label}
                {activeStatus === tab.value && meta ? (
                  <span className="ml-2 text-xs text-muted-foreground">({total})</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Table — min-height prevents layout collapse when switching tabs */}
      <div className="relative rounded-md border bg-card min-h-[420px]">
        {/* Subtle loading indicator — content stays visible underneath */}
        {isFetching && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-background/90 px-3 py-1.5 rounded-full shadow-sm border text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </div>
        )}

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="first:pl-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(
            "transition-opacity duration-150",
            isFetching && "opacity-50 pointer-events-none"
          )}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const status = row.original.status;
                let borderAccent = 'border-l-transparent';
                if (status === 'pending') borderAccent = 'border-l-yellow-400';
                if (status === 'confirmed') borderAccent = 'border-l-blue-400';
                if (status === 'overdue') borderAccent = 'border-l-red-500 bg-red-50/20';

                return (
                  <TableRow
                    key={row.original.id}
                    className={cn(
                      "border-l-4 transition-colors cursor-pointer hover:bg-muted/50",
                      borderAccent
                    )}
                    onClick={() => router.push(`/dashboard/bookings/${row.original.id}`)}
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
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Package className="h-8 w-8 mb-2 opacity-30" />
                    <span>
                      {activeStatus === 'all'
                        ? 'No bookings found.'
                        : `No ${activeTabLabel} bookings found.`}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Server-side Pagination */}
      <div className="flex items-center justify-between py-2">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <>
              Page <span className="font-medium">{currentPage}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
              <span className="hidden sm:inline"> · {total.toLocaleString()} total records</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden sm:inline-flex"
            onClick={() => onPageChange(1)}
            disabled={!canPrevious}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPrevious}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNext}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden sm:inline-flex"
            onClick={() => onPageChange(totalPages)}
            disabled={!canNext}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
