'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const settingsNavItems = [
  {
    title: 'General',
    href: '/dashboard/settings',
    exact: true,
  },
  {
    title: 'Branding',
    href: '/dashboard/settings/branding',
  },
  {
    title: 'Locale',
    href: '/dashboard/settings/locale',
  },
  {
    title: 'Payment',
    href: '/dashboard/settings/payment',
  },
  {
    title: 'Delivery',
    href: '/dashboard/settings/delivery',
  },
  {
    title: 'Operational',
    href: '/dashboard/settings/operational',
  },
  {
    title: 'Domain',
    href: '/dashboard/settings/domain',
  },
  {
    title: 'Subscription',
    href: '/dashboard/settings/subscription',
  },
  {
    title: 'Staff Management',
    href: '/dashboard/settings/staff',
  },
  {
    title: 'Sessions',
    href: '/dashboard/settings/sessions',
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full px-4 py-8 md:px-8">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your store configurations, team members, and security preferences.
        </p>
      </div>
      <div className="shrink-0 bg-border h-[1px] w-full" />
      
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 px-4 lg:px-0 min-w-max lg:min-w-0">
            {settingsNavItems.map((item) => {
              const isActive = item.exact 
                ? pathname === item.href 
                : pathname.startsWith(item.href);
                
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    isActive
                      ? 'bg-muted hover:bg-muted'
                      : 'hover:bg-transparent hover:underline',
                    'justify-start'
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 lg:max-w-3xl border rounded-md shadow-sm bg-card p-6 min-h-[400px]">
          {children}
        </div>
      </div>
    </div>
  );
}
