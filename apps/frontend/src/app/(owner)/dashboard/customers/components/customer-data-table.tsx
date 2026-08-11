'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowUpDown, UserRound } from 'lucide-react';
import { Customer, PaginationMeta } from '@closetrent/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStoreSettings } from '../../settings/hooks/use-settings';

interface Props { data: Customer[]; isLoading: boolean; meta?: PaginationMeta; onPageChange: (page: number) => void; sort: string; onSortChange: (sort: string) => void }

export function CustomerDataTable({ data, isLoading, meta, onPageChange, sort, onSortChange }: Props) {
  const router = useRouter();
  const { data: settingsResponse } = useStoreSettings();
  const currency = settingsResponse?.data.currencyCode || 'BDT';
  const money = (amount: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
  const sortBy = (key: string) => onSortChange(sort === `${key}_asc` ? `${key}_desc` : `${key}_asc`);

  if (isLoading) return <div className="flex flex-col gap-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>;
  if (!data.length) return <Empty><EmptyHeader><EmptyMedia variant="icon"><UserRound /></EmptyMedia><EmptyTitle>No customer profiles</EmptyTitle><EmptyDescription>Adjust the filters or create the first operational customer profile.</EmptyDescription></EmptyHeader></Empty>;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Contact</TableHead><TableHead>Location</TableHead><TableHead><Button variant="ghost" size="sm" onClick={() => sortBy('total_bookings')}>Bookings<ArrowUpDown data-icon="inline-end" /></Button></TableHead><TableHead><Button variant="ghost" size="sm" onClick={() => sortBy('total_spent')}>Lifetime paid<ArrowUpDown data-icon="inline-end" /></Button></TableHead><TableHead>Last booking</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((customer) => <TableRow key={customer.id} className="cursor-pointer" tabIndex={0} onClick={() => router.push(`/dashboard/customers/${customer.id}`)} onKeyDown={(event) => { if (event.key === 'Enter') router.push(`/dashboard/customers/${customer.id}`); }}>
            <TableCell><div className="flex items-center gap-3"><Avatar><AvatarFallback>{customer.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</AvatarFallback></Avatar><div className="flex flex-col gap-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{customer.fullName}</span><Badge variant={customer.status === 'active' ? 'secondary' : 'outline'}>{customer.status}</Badge>{customer.account ? <Badge variant="outline">Account {customer.account.status}</Badge> : null}</div><div className="flex flex-wrap gap-1">{customer.tags.map((tag) => <Badge key={tag.id} variant="outline">{tag.name}</Badge>)}</div></div></div></TableCell>
            <TableCell><div className="flex flex-col gap-1"><span>{customer.primaryPhone ?? 'No phone'}</span><span className="text-xs text-muted-foreground">{customer.primaryEmail ?? 'No email'}</span></div></TableCell>
            <TableCell>{customer.defaultAddress ? <div className="flex flex-col"><span>{customer.defaultAddress.area || customer.defaultAddress.city || 'Address saved'}</span><span className="text-xs text-muted-foreground">{customer.defaultAddress.state || customer.defaultAddress.country}</span></div> : <span className="text-muted-foreground">Not saved</span>}</TableCell>
            <TableCell>{customer.totalBookings}</TableCell><TableCell className="font-medium">{money(customer.totalSpent)}</TableCell><TableCell className="text-muted-foreground">{customer.lastBookingAt ? format(new Date(customer.lastBookingAt), 'dd MMM yyyy') : 'Never'}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      {meta ? <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{meta.total ? `${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}` : '0 results'}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>Next</Button></div></div> : null}
    </div>
  );
}
