'use client';

/**
 * Guest Header — premium tenant-branded storefront header.
 * Uses custom Tailwind (NOT ShadCN/Boxy), with elegant typography and trust bar.
 */

import Link from 'next/link';
import { useTenant } from '@/hooks/use-tenant';
import { useCart } from '@/hooks/use-cart';
import { Menu, Search, ShoppingBag, X, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SearchModal } from '@/components/guest/ui/search-modal';

export function GuestHeader() {
  const { tenant } = useTenant();
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const businessName = tenant?.businessName ?? 'ClosetRent Store';

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 w-full ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white'
        }`}
      >
        {/* ROW 1: Trust/Utility Bar (only visible when not scrolled) */}
        <div
          className={`w-full bg-[#FAFAFA] text-[10px] sm:text-xs font-display tracking-[0.15em] text-gray-500 uppercase overflow-hidden transition-all duration-300 ${
            scrolled ? 'h-0 opacity-0' : 'h-8 opacity-100 flex items-center'
          }`}
        >
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 lg:px-8">
            <div className="hidden sm:flex gap-4 min-w-[120px]">
              <Link href="/help" className="hover:text-black transition-colors">
                Help / FAQ
              </Link>
            </div>
            <div className="text-center flex-1">
              <p>Complimentary styling & easy returns</p>
            </div>
            <div className="hidden sm:flex gap-4 min-w-[120px] justify-end">
              <span>{(tenant as any)?.currency ?? 'USD'}</span>
            </div>
          </div>
        </div>

        {/* ROW 2: Main Navigation */}
        <div
          className={`mx-auto flex max-w-[1600px] items-center justify-between px-4 lg:px-8 transition-all duration-300 ${
            scrolled ? 'h-16' : 'h-20'
          }`}
        >
          {/* Left: Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 flex-1">
            <div className="group relative">
              <Link
                href="/products"
                className="text-[13px] font-display font-medium uppercase tracking-[0.1em] text-[#1C1C1E] transition-colors relative py-2"
              >
                Clothing
                <span className="absolute left-0 bottom-0 h-[1px] w-0 bg-brand-600 transition-all duration-500 ease-out group-hover:w-full"></span>
              </Link>
            </div>
            <div className="group relative">
              <Link
                href="/products?category=occasions"
                className="text-[13px] font-display font-medium uppercase tracking-[0.1em] text-[#1C1C1E] transition-colors relative py-2"
              >
                Occasions
                <span className="absolute left-0 bottom-0 h-[1px] w-0 bg-brand-600 transition-all duration-500 ease-out group-hover:w-full"></span>
              </Link>
            </div>
            <div className="group relative">
              <Link
                href="/designers"
                className="text-[13px] font-display font-medium uppercase tracking-[0.1em] text-[#1C1C1E] transition-colors relative py-2"
              >
                Designers
                <span className="absolute left-0 bottom-0 h-[1px] w-0 bg-brand-600 transition-all duration-500 ease-out group-hover:w-full"></span>
              </Link>
            </div>
          </nav>

          {/* Center: Logo (Editorial Serif) */}
          <Link
            href="/"
            className="flex flex-1 items-center justify-center shrink-0 transition-transform duration-300 hover:opacity-80"
          >
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={businessName}
                className={`w-auto object-contain transition-all duration-300 ${
                  scrolled ? 'h-7' : 'h-9'
                }`}
              />
            ) : (
              <span
                className={`font-editorial font-medium tracking-wide text-[#1C1C1E] transition-all duration-300 ${
                  scrolled ? 'text-2xl' : 'text-3xl'
                }`}
              >
                {businessName}
              </span>
            )}
          </Link>

          {/* Right: Actions */}
          <div className="flex flex-1 items-center justify-end gap-5 lg:gap-6">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-[#1C1C1E] transition-opacity hover:opacity-60 hidden md:block"
              aria-label="Search"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
            <Link
              href="/account"
              className="text-[#1C1C1E] transition-opacity hover:opacity-60 hidden md:block"
              aria-label="Account"
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Link>
            <Link
              href="/cart"
              className="relative text-[#1C1C1E] group flex items-center gap-2"
            >
              <span className="text-[11px] font-display uppercase tracking-widest hidden lg:block transition-colors group-hover:text-brand-600">
                Bag
              </span>
              <div className="relative transition-transform duration-300 group-hover:-translate-y-[1px]">
                <ShoppingBag
                  className="h-[18px] w-[18px] transition-colors group-hover:text-brand-600"
                  strokeWidth={1.5}
                />
                {mounted && totalItems > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                    {totalItems}
                  </span>
                )}
              </div>
            </Link>

            {/* Mobile Hamburger Trigger */}
            <button
              type="button"
              className="text-[#1C1C1E] transition-opacity hover:opacity-60 md:hidden ml-2"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Mobile Fullscreen Menu */}
        <div
          className={`fixed inset-0 z-50 bg-white transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) md:hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100">
            <span className="font-editorial text-xl font-medium tracking-wide text-[#1C1C1E]">
              {businessName}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-[#1C1C1E] hover:opacity-60 transition-opacity"
            >
              <X className="h-6 w-6" strokeWidth={1.5} />
            </button>
          </div>
          <nav className="flex flex-col px-6 py-10 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-8 font-editorial text-4xl mb-12 text-[#1C1C1E]">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-brand-600 transition-colors"
              >
                Home
              </Link>
              <Link
                href="/products"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-brand-600 transition-colors"
              >
                Clothing
              </Link>
              <Link
                href="/products?category=occasions"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-brand-600 transition-colors"
              >
                Occasions
              </Link>
              <Link
                href="/designers"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-brand-600 transition-colors"
              >
                Designers
              </Link>
            </div>

            <div className="mt-auto border-t border-gray-100 pt-8 flex flex-col gap-6">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSearchOpen(true);
                }}
                className="flex items-center gap-4 text-sm font-display uppercase tracking-widest text-[#1C1C1E] hover:text-brand-600 transition-colors"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={1.5} /> Search
              </button>
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-4 text-sm font-display uppercase tracking-widest text-[#1C1C1E] hover:text-brand-600 transition-colors"
              >
                <User className="h-[18px] w-[18px]" strokeWidth={1.5} /> Account
              </Link>
              <Link
                href="/help"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-4 text-sm font-display uppercase tracking-widest text-[#1C1C1E] hover:text-brand-600 transition-colors"
              >
                Help / FAQ
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
