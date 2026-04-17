'use client';

import { useTenant } from '@/hooks/use-tenant';
import Link from 'next/link';

export function GuestFooter() {
  const { tenant } = useTenant();
  const year = new Date().getFullYear();
  const businessName = tenant?.businessName ?? 'ClosetRent Store';

  return (
    <footer className="w-full border-t border-gray-200 bg-stone-50 pb-8 pt-16 sm:pt-24">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 border border-gray-200 lg:grid-cols-2">
          {/* Left Panel - Brand & Narrative */}
          <div className="flex flex-col justify-between border-b border-gray-200 p-8 transition-colors duration-500 hover:bg-white lg:border-b-0 lg:border-r lg:p-12">
            <div>
              <Link href="/" className="mb-8 inline-block">
                {tenant?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.logoUrl}
                    alt={businessName}
                    className="h-8 w-auto mix-blend-multiply grayscale transition-all duration-500 hover:grayscale-0"
                  />
                ) : (
                  <span className="font-display text-2xl font-bold uppercase tracking-tight text-gray-900">
                    {businessName}
                  </span>
                )}
              </Link>
              <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                {tenant?.about ||
                  'Your premier destination for high-quality fashion rentals. Elevate your wardrobe sustainably with our curated collections.'}
              </p>
            </div>

            {/* Contact Info */}
            <div className="mt-16 space-y-4 text-sm text-gray-600">
              {tenant?.phone && (
                <div className="flex items-center gap-4">
                  <span className="w-16 text-[10px] font-semibold uppercase tracking-widest text-gray-900">
                    Phone
                  </span>
                  <span>{tenant.phone}</span>
                </div>
              )}
              {tenant?.email && (
                <div className="flex items-center gap-4">
                  <span className="w-16 text-[10px] font-semibold uppercase tracking-widest text-gray-900">
                    Email
                  </span>
                  <span>{tenant.email}</span>
                </div>
              )}
              {tenant?.address && (
                <div className="flex items-start gap-4">
                  <span className="mt-1 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-900">
                    Studio
                  </span>
                  <span className="max-w-[200px] leading-snug">{tenant.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Pathways */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {/* The Journey */}
            <div className="border-b border-gray-200 p-8 transition-colors duration-500 hover:bg-white sm:border-b-0 sm:border-r lg:p-12">
              <h3 className="mb-8 text-[11px] font-semibold uppercase tracking-widest text-gray-900">
                The Journey
              </h3>
              <ul className="space-y-5 text-sm text-gray-500">
                <li>
                  <Link href="/" className="block transition-colors hover:text-black">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/products" className="block transition-colors hover:text-black">
                    Browse Collection
                  </Link>
                </li>
                <li>
                  <Link href="/booking/track" className="block transition-colors hover:text-black">
                    Track Order
                  </Link>
                </li>
              </ul>
            </div>

            {/* Assistance */}
            <div className="p-8 transition-colors duration-500 hover:bg-white lg:p-12">
              <h3 className="mb-8 text-[11px] font-semibold uppercase tracking-widest text-gray-900">
                Assistance
              </h3>
              <ul className="space-y-5 text-sm text-gray-500">
                <li>
                  <Link href="/faq" className="block transition-colors hover:text-black">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/returns" className="block transition-colors hover:text-black">
                    Returns Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="block transition-colors hover:text-black">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="block transition-colors hover:text-black">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar - Signature */}
        <div className="mt-4 flex flex-col items-center justify-between gap-4 border border-gray-200 bg-transparent p-5 text-[11px] text-gray-500 transition-colors duration-500 hover:bg-white sm:flex-row sm:px-8">
          <div className="flex gap-2">
            <span>© {year} {businessName}.</span>
            <span className="hidden sm:inline">All rights reserved.</span>
          </div>

          {(tenant?.facebookUrl || tenant?.instagramUrl) && (
            <div className="flex gap-6 font-medium uppercase tracking-widest text-gray-900">
              {tenant?.facebookUrl && (
                <a
                  href={tenant.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-gray-500"
                >
                  Facebook
                </a>
              )}
              {tenant?.instagramUrl && (
                <a
                  href={tenant.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-gray-500"
                >
                  Instagram
                </a>
              )}
            </div>
          )}

          <div>
            Powered by <span className="font-semibold text-gray-900">ClosetRent</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
