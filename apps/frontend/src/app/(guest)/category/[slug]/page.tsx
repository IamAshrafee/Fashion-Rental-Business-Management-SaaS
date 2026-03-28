'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ProductCard } from '@/components/guest/ui/product-card';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { FilterSidebar } from '@/components/guest/ui/filter-sidebar';

export default function GuestCategoryPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const categoryName = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Category';

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Dummy products just for layout demonstration
  const featuredProducts = [
    {
      id: '1',
      slug: 'royal-banarasi-saree',
      name: `Royal Banarasi ${categoryName}`,
      category: categoryName,
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
      slug: `velvet-bridal-${slug}`,
      name: `Velvet Bridal ${categoryName}`,
      category: categoryName,
      eventNames: ['Wedding'],
      basePrice: 12000,
      imageUrl: '/placeholder-lehenga.jpg',
      isAvailable: false,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Category Header */}
      <div className="mb-12 rounded-2xl bg-gray-100 p-8 text-center sm:p-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-gray-900">{categoryName} Collection</h1>
        <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
          Explore our exclusive collection of premium {categoryName.toLowerCase()}s perfect for your next big event. Rent luxury fashion for a fraction of the price.
        </p>
      </div>

      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Explore {categoryName}s</h2>
          <p className="text-sm text-gray-500">Showing 24 results</p>
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
                <option>Most Popular</option>
                <option>Newest Arrivals</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
            {featuredProducts.map((product) => (
              <ProductCard key={`${product.id}-clone-1`} {...product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
