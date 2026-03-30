'use client';

import { useTenant } from '@/hooks/use-tenant';
import Link from 'next/link';
import { Facebook, Instagram, Phone, Mail, MapPin } from 'lucide-react';

export function GuestFooter() {
  const { tenant } = useTenant();
  const year = new Date().getFullYear();
  const businessName = tenant?.businessName ?? 'ClosetRent Store';

  return (
    <footer className="border-t bg-white pt-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand & About */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-block">
              {tenant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logoUrl}
                  alt={businessName}
                  className="mb-4 h-8 w-auto grayscale transition-all hover:grayscale-0"
                />
              ) : (
                <span className="mb-4 block font-display text-xl font-bold tracking-tight">
                  {businessName}
                </span>
              )}
            </Link>
            {tenant?.about ? (
              <p className="text-sm text-gray-500">{tenant.about}</p>
            ) : (
              <p className="text-sm text-gray-500">
                Your premier destination for high-quality fashion rentals.
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 font-semibold text-gray-900">Quick Links</h3>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>
                <Link href="/" className="transition-colors hover:text-black">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/products" className="transition-colors hover:text-black">
                  Browse Collection
                </Link>
              </li>
              <li>
                <Link href="/booking/track" className="transition-colors hover:text-black">
                  Track Order
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 font-semibold text-gray-900">Contact Us</h3>
            <ul className="space-y-3 text-sm text-gray-500">
              {tenant?.phone && (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{tenant.phone}</span>
                </li>
              )}
              {tenant?.email && (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{tenant.email}</span>
                </li>
              )}
              {tenant?.address && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{tenant.address}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Socials & Newsletter */}
          <div>
            <h3 className="mb-4 font-semibold text-gray-900">Follow Us</h3>
            <div className="flex gap-4">
              {tenant?.facebookUrl && (
                <a
                  href={tenant.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 transition-colors hover:text-black"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {tenant?.instagramUrl && (
                <a
                  href={tenant.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 transition-colors hover:text-black"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {(!tenant?.facebookUrl && !tenant?.instagramUrl) && (
                <span className="text-sm text-gray-500">No social links configured.</span>
              )}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-gray-100 py-6 sm:flex-row">
          <p className="text-sm text-gray-400">
            © {year} {businessName}. All rights reserved.
          </p>
          <p className="mt-2 text-xs text-gray-300 sm:mt-0">
            Powered by ClosetRent
          </p>
        </div>
      </div>
    </footer>
  );
}
