'use client';

import { Customer } from '@closetrent/types';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, User } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useStoreSettings } from '../../settings/hooks/use-settings';

interface CustomerDataTableProps {
  data: Customer[];
  isLoading: boolean;
  meta: any;
  onPageChange: (page: number) => void;
  sort: string;
  onSortChange: (sort: string) => void;
}

export function CustomerDataTable({ 
    data, 
    isLoading, 
    meta, 
    onPageChange, 
    sort, 
    onSortChange 
}: CustomerDataTableProps) {
  const router = useRouter();
  const { data: settingsResponse } = useStoreSettings();
  const settings = settingsResponse?.data;

  // #14: Use currency from store settings, fallback to BDT
  const currencyCode = settings?.currencyCode || 'BDT';

  const handleSort = (key: string) => {
    if (sort === `${key}_asc`) {
      onSortChange(`${key}_desc`);
    } else {
      onSortChange(`${key}_asc`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading customers...</div>;
  }

  if (data.length === 0) {
    return <div className="p-8 text-center text-muted-foreground border-t">No customers found.</div>;
  }

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('name')} className="px-0 py-1 hover:bg-transparent -ml-2">
                Customer <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">
              <Button variant="ghost" onClick={() => handleSort('total_bookings')} className="px-0 py-1 hover:bg-transparent">
                Orders <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button variant="ghost" onClick={() => handleSort('total_spent')} className="px-0 py-1 hover:bg-transparent">
                Spent <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button variant="ghost" onClick={() => handleSort('last_booking_at')} className="px-0 py-1 hover:bg-transparent pr-4">
                Last Order <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((customer) => (
            <TableRow 
              key={customer.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
            >
              <TableCell>
                <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center text-primary">
                  <User size={16} />
                </div>
              </TableCell>
              {/* S4: Fixed - use text-foreground instead of text-gray-900 */}
              <TableCell>
                <div className="font-medium text-foreground">{customer.fullName}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {customer.tags?.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{customer.phone}</TableCell>
              <TableCell className="text-right font-medium">{customer.totalBookings}</TableCell>
              <TableCell className="text-right font-medium text-emerald-600">
                {formatCurrency(customer.totalSpent)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground pr-4">
                {customer.lastBookingAt 
                  ? format(new Date(customer.lastBookingAt), 'MMM d, yyyy') 
                  : 'N/A'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {meta && (
        <div className="flex items-center justify-between px-4 py-4 border-t text-sm text-muted-foreground">
          <div>
            Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.page - 1)}
              disabled={meta.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
