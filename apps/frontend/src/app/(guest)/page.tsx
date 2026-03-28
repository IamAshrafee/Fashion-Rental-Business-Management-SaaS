'use client';

import { useTenant } from '@/hooks/use-tenant';
import Link from 'next/link';
import { ProductCard } from '@/components/guest/ui/product-card';
import { ArrowRight } from 'lucide-react';

export default function GuestHomePage() {
  const { tenant } = useTenant();

  // Dummy products just for layout demonstration
  const featuredProducts = [
    {
      id: '1',
      slug: 'royal-banarasi-saree',
      name: 'Royal Banarasi Saree',
      category: 'Saree',
      eventNames: ['Wedding', 'Reception'],
      basePrice: 7500,
      imageUrl: '/placeholder-saree.jpg',
      variants: [
        { id: 'v1', name: 'Red', colorHex: '#ef4444', imageUrl: '/placeholder-saree-red.jpg' },
        { id: 'v2', name: 'Gold', colorHex: '#fbbf24', imageUrl: '/placeholder-saree-gold.jpg' },
      ],
      isAvailable: true,
    },
    {
      id: '2',
      slug: 'velvet-bridal-lehenga',
      name: 'Velvet Bridal Lehenga',
      category: 'Lehenga',
      eventNames: ['Wedding'],
      basePrice: 12000,
      imageUrl: '/placeholder-lehenga.jpg',
      isAvailable: false,
    },
    {
      id: '3',
      slug: 'designer-embellished-gown',
      name: 'Designer Embellished Gown',
      category: 'Gown',
      eventNames: ['Reception', 'Party'],
      basePrice: 5000,
      imageUrl: '/placeholder-gown.jpg',
      isAvailable: true,
    },
    {
      id: '4',
      slug: 'silk-sherwani',
      name: 'Premium Silk Sherwani',
      category: 'Sherwani',
      eventNames: ['Wedding'],
      basePrice: 8500,
      imageUrl: '/placeholder-sherwani.jpg',
      isAvailable: true,
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex h-[60vh] w-full flex-col items-center justify-center bg-gray-900 bg-cover bg-center text-center sm:h-[70vh]" style={{ backgroundImage: "url('/placeholder-hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-white">
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-6xl">
            {tenant?.tagline || 'Experience Premium Fashion On Rent'}
          </h1>
          <p className="mt-4 text-lg font-light tracking-wide text-gray-200 sm:text-xl">
            {tenant?.businessName || 'ClosetRent Store'}
          </p>
          <div className="mt-8">
            <Link
              href="/products"
              className="inline-flex appearance-none items-center gap-2 bg-white px-8 py-4 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-gray-200"
            >
              Browse Collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900 tracking-tight">Shop by Category</h2>
          <div className="mx-auto mt-2 h-1 w-16 bg-black" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-8">
          {['Sarees', 'Lehengas', 'Gowns', 'Sherwanis'].map((cat) => (
             <Link href={`/category/${cat.toLowerCase()}`} key={cat} className="group relative block aspect-square overflow-hidden bg-gray-100">
               <div className="absolute inset-0 bg-black/20 transition-opacity group-hover:bg-black/40 z-10" />
               <div className="absolute inset-0 flex items-center justify-center z-20">
                 <span className="bg-white/90 px-4 py-2 text-sm font-medium uppercase tracking-wide text-black backdrop-blur-sm transition-transform group-hover:scale-110">
                   {cat}
                 </span>
               </div>
             </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900 tracking-tight">Trending Now</h2>
            <div className="mx-auto mt-2 h-1 w-16 bg-black" />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Link
              href="/products"
              className="inline-flex items-center text-sm font-medium uppercase tracking-wide text-gray-600 transition-colors hover:text-black hover:underline"
            >
              View All Products
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
