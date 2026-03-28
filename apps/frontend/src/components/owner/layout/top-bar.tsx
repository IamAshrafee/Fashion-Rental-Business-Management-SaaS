'use client';

/**
 * Owner Top Bar — header for the owner portal.
 * Shows mobile menu trigger, store name, and profile dropdown.
 */

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, Settings } from 'lucide-react';
import { OwnerSidebar } from './sidebar';
import { OwnerBreadcrumbs } from './breadcrumbs';
import { TopBarNotifications } from './notifications';

export function TopBar() {
  const { user, logout } = useAuth();

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
      {/* Mobile sidebar trigger */}
      <OwnerSidebar />

      {/* Breadcrumbs (Desktop) */}
      <div className="ml-2 hidden md:block">
        <OwnerBreadcrumbs />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <TopBarNotifications />

      {/* Profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.fullName ?? 'User'}</p>
              <p className="text-xs text-muted-foreground">
                {user?.email ?? user?.phone ?? ''}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
