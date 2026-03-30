'use client';

/**
 * TopBar Notifications Component
 * Real-time notification bell with dropdown, polling every 30s.
 * Wired to backend: GET /owner/notifications, unread-count, mark-read, dismiss.
 */

import Link from 'next/link';
import { Bell, Check, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi, type Notification } from '@/lib/api/notifications';

const POLL_INTERVAL = 30_000; // 30 seconds

// Query keys
const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function TopBarNotifications() {
  const queryClient = useQueryClient();

  // Poll unread count every 30s (lightweight)
  const { data: countData } = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: POLL_INTERVAL,
    staleTime: 10_000,
  });

  // Fetch recent notifications (loaded on dropdown open, refetched with unread count)
  const { data: listData, isLoading } = useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationApi.getNotifications({ limit: 10 }),
    refetchInterval: POLL_INTERVAL,
    staleTime: 10_000,
  });

  const unreadCount = countData?.data?.unreadCount ?? 0;
  const notifications: Notification[] = listData?.data ?? [];

  // Mark all read
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // Mark single read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // Dismiss
  const dismissMutation = useMutation({
    mutationFn: (id: string) => notificationApi.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-primary"
              disabled={markAllReadMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                markAllReadMutation.mutate();
              }}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((note) => (
              <DropdownMenuItem
                key={note.id}
                className={`cursor-pointer flex flex-col items-start p-3 gap-1 ${
                  !note.isRead ? 'bg-primary/5' : ''
                }`}
                onSelect={(e) => {
                  e.preventDefault();
                  if (!note.isRead) {
                    markReadMutation.mutate(note.id);
                  }
                }}
              >
                <div className="flex w-full items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {!note.isRead && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{note.title}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(note.createdAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismissMutation.mutate(note.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2 pl-4">
                  {note.message}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <div className="p-2">
          <Link
            href="/dashboard/notifications"
            className="block w-full text-center text-xs font-medium text-primary hover:underline"
          >
            View all notifications
            {(listData?.meta?.total ?? 0) > notifications.length && (
              <span className="text-muted-foreground font-normal ml-1">
                ({listData?.meta?.total} total)
              </span>
            )}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
