'use client';

/**
 * TopBar Notifications Component
 * Shell for the upcoming P10 (Notifications & Background Jobs) package.
 * Displays a bell icon with an unread badge and a dropdown of recent notifications.
 */

import { Bell } from 'lucide-react';
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
import Link from 'next/link';
import { useState } from 'react';

// Mock data until P10 is implemented
const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'New Booking Request', message: 'Fatima Rahman requested an Evening Gown', time: '5m' },
  { id: '2', title: 'Item Overdue', message: 'Booking #ORD-0038 is 2 days late', time: '1h' },
];

export function TopBarNotifications() {
  // Temporary state for the mock
  const [unreadCount, setUnreadCount] = useState(MOCK_NOTIFICATIONS.length);

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
              {unreadCount}
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
              onClick={(e) => {
                e.preventDefault();
                setUnreadCount(0);
              }}
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {unreadCount === 0 || MOCK_NOTIFICATIONS.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {MOCK_NOTIFICATIONS.map((note) => (
              <DropdownMenuItem key={note.id} className="cursor-pointer flex flex-col items-start p-3 gap-1">
                <div className="flex w-full items-start justify-between">
                  <span className="font-medium text-sm">{note.title}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{note.time}</span>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">{note.message}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer justify-center text-primary font-medium">
          <Link href="/dashboard/settings/notifications" className="w-full text-center">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
