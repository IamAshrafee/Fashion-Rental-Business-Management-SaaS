'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/guest/ui/product-card';
import { FilterSidebar } from '@/components/guest/ui/filter-sidebar';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';

export default function GuestProductsPage() {
  const { tenant } = useTenant();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Page Header */}
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900">All Products</h1>
          <p className="text-sm text-gray-500">Showing 85 results</p>
        </div>
        
        <div className="flex w-full items-center justify-between gap-4 md:w-auto">
          <button 
            type="button" 
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-2 border border-black bg-white px-4 py-2 text-sm font-medium uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <div className="relative">
              <select className="appearance-none rounded-none border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 outline-none focus:border-black focus:ring-0">
                <option>Newest Arrivals</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Most Popular</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:gap-8">
        
        {/* Sidebar wrapper */}
        <FilterSidebar mobileOpen={mobileFilterOpen} setMobileOpen={setMobileFilterOpen} />
        
        {/* Products Grid */}
        <div className="flex-1">
          {/* Quick filter pills */}
          <div className="mb-6 hidden flex-wrap gap-2 md:flex">
             {['All', 'Under ৳5K', 'Wedding', 'New'].map(pill => (
               <span key={pill} className="cursor-pointer rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-black hover:bg-black hover:text-white">
                 {pill}
               </span>
             ))}
          </div>
          
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
            {featuredProducts.map((product) => (
              <ProductCard key={`${product.id}-clone-1`} {...product} />
            ))}
             {featuredProducts.map((product) => (
              <ProductCard key={`${product.id}-clone-2`} {...product} />
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <button
               type="button"
               className="inline-block border border-black bg-transparent px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
            >
               Load More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
