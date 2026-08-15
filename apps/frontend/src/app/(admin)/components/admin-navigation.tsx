'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BadgePercent,
  Banknote,
  Building2,
  Gauge,
  LayoutDashboard,
  Menu,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AdminLogoutButton } from './admin-logout-button';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { label: 'Revenue', href: '/admin/revenue', icon: Banknote },
  { label: 'Resource monitor', href: '/admin/resources', icon: Gauge },
  { label: 'Subscription plans', href: '/admin/plans', icon: PanelLeft },
  { label: 'Promo codes', href: '/admin/promo-codes', icon: BadgePercent },
  { label: 'Activity log', href: '/admin/activity', icon: Activity },
] as const;

function NavigationContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = NAV_ITEMS
    .filter(({ href }) => pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`)))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-14 items-center gap-3 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          CR
        </div>
        <div>
          <p className="font-display text-sm font-semibold leading-none">ClosetRent</p>
          <p className="mt-1 text-[11px] text-muted-foreground">SaaS administration</p>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" aria-label="SaaS administration">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = activeHref === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t p-4">
        <AdminLogoutButton />
      </div>
    </div>
  );
}

export function AdminNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        <NavigationContent />
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open admin navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">SaaS administration navigation</SheetTitle>
            <NavigationContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-display text-sm font-semibold">ClosetRent Admin</span>
      </header>
    </>
  );
}
