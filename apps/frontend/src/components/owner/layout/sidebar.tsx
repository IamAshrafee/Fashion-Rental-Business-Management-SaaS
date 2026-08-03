'use client';

/**
 * Owner Sidebar — collapsible navigation for the owner portal.
 * Uses shadcn Sheet on mobile, fixed sidebar on desktop.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Package,
  CalendarCheck,
  Users,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  Truck,
  Activity,
  Archive,
  Boxes,
  ArrowLeftRight,
  CalendarRange,
  ClipboardList,
  MapPin,
  Wrench,
} from 'lucide-react';
import type { NavItem } from '@/types';

const NAV_GROUPS: Array<{ label?: string; items: NavItem[] }> = [
  { items: [{ title: 'Overview', href: '/dashboard', icon: LayoutDashboard }] },
  {
    label: 'Catalog',
    items: [{ title: 'Products', href: '/dashboard/products', icon: Package }],
  },
  {
    label: 'Inventory',
    items: [
      { title: 'Inventory overview', href: '/dashboard/inventory', icon: Archive },
      { title: 'Stock by SKU', href: '/dashboard/inventory/stock', icon: Boxes },
      { title: 'Physical items', href: '/dashboard/inventory/items', icon: ClipboardList },
      { title: 'Transfers', href: '/dashboard/inventory/transfers', icon: ArrowLeftRight },
      { title: 'Locations & policies', href: '/dashboard/inventory/locations', icon: MapPin },
    ],
  },
  {
    label: 'Rentals',
    items: [
      { title: 'Bookings', href: '/dashboard/bookings', icon: CalendarCheck },
      { title: 'Rental calendar', href: '/dashboard/bookings/calendar', icon: CalendarRange },
      { title: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
    ],
  },
  { items: [{ title: 'Customers', href: '/dashboard/customers', icon: Users }] },
  { items: [{ title: 'Operations', href: '/dashboard/operations', icon: Wrench }] },
  {
    label: 'Reports',
    items: [
      { title: 'Sales analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { title: 'Traffic & funnel', href: '/dashboard/traffic', icon: Activity },
    ],
  },
  { items: [{ title: 'Settings', href: '/dashboard/settings', icon: Settings }] },
];

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const activeHref = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <div className="flex h-full flex-col">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          CR
        </div>
        {!collapsed && <span className="font-display text-lg font-semibold">ClosetRent</span>}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 md:hidden lg:hidden"
            onClick={onToggle}
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
            />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-4">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label || groupIndex} className="space-y-1">
              {group.label && !collapsed && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = activeHref === item.href;
                const Icon = item.icon;

                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        collapsed && 'justify-center px-2',
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                      {!collapsed && item.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="p-4">
        {!collapsed && (
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ClosetRent</p>
        )}
      </div>
    </div>
  );
}

export function OwnerSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden border-r bg-card transition-all duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:w-64',
        )}
      >
        <SidebarContent collapsed={false} />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" id="mobile-menu-trigger">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function useOwnerSidebarWidth() {
  // This is a simplified approach; in a real app, use context
  return 'lg:pl-64';
}
