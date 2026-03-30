'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogApi, type AuditLogEntry, type AuditLogQuery } from '@/lib/api/audit-logs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: 'booking', label: 'Bookings' },
  { value: 'booking_item', label: 'Booking Items' },
  { value: 'payment', label: 'Payments' },
  { value: 'product', label: 'Products' },
] as const;

const ACTION_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'booking.created': { label: 'Created', variant: 'default' },
  'booking.confirmed': { label: 'Confirmed', variant: 'default' },
  'booking.shipped': { label: 'Shipped', variant: 'secondary' },
  'booking.delivered': { label: 'Delivered', variant: 'secondary' },
  'booking.returned': { label: 'Returned', variant: 'secondary' },
  'booking.inspected': { label: 'Inspected', variant: 'outline' },
  'booking.completed': { label: 'Completed', variant: 'default' },
  'booking.cancelled': { label: 'Cancelled', variant: 'destructive' },
  'booking.damage_reported': { label: 'Damage Reported', variant: 'destructive' },
  'payment.received': { label: 'Payment Received', variant: 'default' },
  'deposit.refunded': { label: 'Deposit Refunded', variant: 'secondary' },
  'deposit.forfeited': { label: 'Deposit Forfeited', variant: 'destructive' },
  'product.published': { label: 'Published', variant: 'default' },
  'product.updated': { label: 'Updated', variant: 'secondary' },
  'product.soft_deleted': { label: 'Moved to Trash', variant: 'destructive' },
  'product.restored': { label: 'Restored', variant: 'outline' },
};

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AuditLogSettingsPage() {
  const [filters, setFilters] = useState<AuditLogQuery>({
    page: 1,
    limit: 20,
  });
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const queryParams: AuditLogQuery = {
    ...filters,
    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => auditLogApi.getAuditLogs(queryParams),
    staleTime: 30_000,
  });

  const logs: AuditLogEntry[] = data?.data ?? [];
  const meta = data?.meta;

  const clearFilters = () => {
    setEntityTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setFilters({ page: 1, limit: 20 });
    setShowFilters(false);
  };

  const hasActiveFilters = entityTypeFilter || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Activity Log</h3>
        <p className="text-sm text-muted-foreground">
          Review all significant actions across your store — bookings, payments, products, and more.
        </p>
      </div>
      <Separator />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {hasActiveFilters && (
              <Badge variant="default" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                !
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {meta ? `${meta.total} entries · Page ${meta.page} of ${meta.totalPages}` : ''}
        </p>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 border rounded-md bg-muted/30">
          <div className="w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Entity Type</label>
            <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v === 'all' ? '' : v); setFilters(f => ({ ...f, page: 1 })); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setFilters(f => ({ ...f, page: 1 })); }}
              className="w-[160px]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setFilters(f => ({ ...f, page: 1 })); }}
              className="w-[160px]"
            />
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg bg-muted/20">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No activity logged yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Actions like bookings, payments, and product changes will appear here.
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Action</TableHead>
                <TableHead className="w-[100px]">Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-[120px] text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, variant: 'outline' as const };
                const details = log.newValues as Record<string, unknown> | null;

                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={actionInfo.variant} className="text-xs">
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {log.entityType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {details?.bookingNumber != null && (
                          <span className="text-sm font-medium">{String(details.bookingNumber)}</span>
                        )}
                        {details?.amount != null && (
                          <span className="text-xs text-muted-foreground">
                            ৳{String(details.amount)}
                          </span>
                        )}
                        {details?.reason != null && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {String(details.reason)}
                          </span>
                        )}
                        {details?.damageLevel != null && (
                          <span className="text-xs text-muted-foreground">
                            Level: {String(details.damageLevel)}
                          </span>
                        )}
                        {details?.bookingNumber == null && details?.amount == null && (
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                            {log.entityId.slice(0, 12)}…
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-default">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date(log.createdAt), 'PPpp')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={meta.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 tabular-nums">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
