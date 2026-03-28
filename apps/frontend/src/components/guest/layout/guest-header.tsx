'use client';

/**
 * Guest Header — tenant-branded storefront header.
 * Uses custom Tailwind (NOT ShadCN) per ADR-01.
 */

import Link from 'next/link';
import { useTenant } from '@/hooks/use-tenant';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';

export function GuestHeader() {
  const { tenant } = useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const businessName = tenant?.businessName ?? 'ClosetRent Store';

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo / Business Name */}
        <Link href="/" className="flex items-center gap-2">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={businessName}
              className="h-8 w-auto"
            />
          ) : (
            <span className="font-display text-xl font-bold tracking-tight">
              {businessName}
            </span>
          )}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm font-medium text-gray-700 transition-colors hover:text-black"
          >
            Home
          </Link>
          <Link
            href="/browse"
            className="text-sm font-medium text-gray-700 transition-colors hover:text-black"
          >
            Browse
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-gray-700 transition-colors hover:text-black"
          >
            About
          </Link>
        </nav>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="relative rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
          >
            <ShoppingBag className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-black md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav className="border-t bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/browse"
              className="text-sm font-medium text-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
