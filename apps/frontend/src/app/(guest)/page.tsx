/**
 * Storefront Home Page — placeholder.
 * Full implementation in P17.
 */

import Link from 'next/link';

export default function GuestHomePage() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center px-4">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        Premium Fashion Rentals
      </h1>
      <p className="mt-4 max-w-xl text-lg text-gray-500">
        Discover the perfect outfit for your next event. Rent designer dresses,
        suits, and accessories at a fraction of the retail price.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/browse"
          className="rounded-full bg-black px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
        >
          Browse Collection
        </Link>
        <Link
          href="/about"
          className="rounded-full bg-white px-6 py-3 font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-105"
        >
          How it Works
        </Link>
      </div>
    </div>
  );
}
