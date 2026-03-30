'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi, type Notification } from '@/lib/api/notifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─── Notification type labels + icons ───────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string }> = {
  new_booking: { label: 'New Booking', color: 'bg-blue-500' },
  booking_confirmed: { label: 'Confirmed', color: 'bg-emerald-500' },
  booking_cancelled: { label: 'Cancelled', color: 'bg-red-500' },
  booking_shipped: { label: 'Shipped', color: 'bg-violet-500' },
  booking_delivered: { label: 'Delivered', color: 'bg-teal-500' },
  booking_overdue: { label: 'Overdue', color: 'bg-orange-500' },
  booking_returned: { label: 'Returned', color: 'bg-cyan-500' },
  booking_completed: { label: 'Completed', color: 'bg-emerald-600' },
  booking_inspected: { label: 'Inspected', color: 'bg-indigo-500' },
  payment_received: { label: 'Payment', color: 'bg-green-500' },
  deposit_refunded: { label: 'Refund', color: 'bg-amber-500' },
  deposit_forfeited: { label: 'Forfeited', color: 'bg-red-600' },
  damage_reported: { label: 'Damage', color: 'bg-rose-500' },
  return_reminder: { label: 'Reminder', color: 'bg-yellow-500' },
  subscription_expiring: { label: 'Subscription', color: 'bg-purple-500' },
  tenant_suspended: { label: 'Suspended', color: 'bg-red-700' },
};

// Query keys (same as TopBarNotifications)
const notificationKeys = {
  all: ['notifications'] as const,
  list: (params: Record<string, unknown>) => [...notificationKeys.all, 'list', params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const limit = 20;

  const queryParams = { page, limit, unreadOnly };

  const { data, isLoading } = useQuery({
    queryKey: notificationKeys.list(queryParams),
    queryFn: () => notificationApi.getNotifications(queryParams),
    staleTime: 10_000,
  });

  const notifications: Notification[] = data?.data ?? [];
  const meta = data?.meta;
  const unreadCount = meta?.unreadCount ?? 0;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => notificationApi.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  return (
    <div className="flex-1 space-y-6 max-w-4xl mx-auto w-full px-4 py-8 md:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            {unreadOnly ? 'Showing Unread' : 'All'}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-1.5" />
              )}
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="shrink-0 bg-border h-[1px] w-full" />

      {/* Notification list */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg bg-muted/20">
          <BellOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {unreadOnly
              ? 'Switch to "All" to see your notification history.'
              : 'Notifications will appear here when bookings, payments, or other events occur.'}
          </p>
          {unreadOnly && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setUnreadOnly(false); setPage(1); }}
            >
              Show all notifications
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((note) => {
            const typeMeta = TYPE_META[note.type] ?? { label: note.type, color: 'bg-gray-500' };

            return (
              <div
                key={note.id}
                className={cn(
                  'group relative flex items-start gap-4 p-4 border rounded-lg transition-colors',
                  !note.isRead
                    ? 'bg-primary/[0.03] border-primary/20 hover:bg-primary/[0.06]'
                    : 'bg-card hover:bg-muted/50',
                )}
              >
                {/* Unread indicator dot */}
                <div className="flex-shrink-0 pt-1">
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-full transition-opacity',
                      !note.isRead ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] px-1.5 py-0 text-white font-medium', typeMeta.color)}
                    >
                      {typeMeta.label}
                    </Badge>
                    <span className="font-medium text-sm">{note.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {note.message}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground/70 cursor-default">
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {format(new Date(note.createdAt), 'PPpp')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!note.isRead && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => markReadMutation.mutate(note.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mark as read</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => dismissMutation.mutate(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Dismiss</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-3 tabular-nums">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
