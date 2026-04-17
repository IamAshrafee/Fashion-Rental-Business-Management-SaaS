'use client';

import { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/guest/ui/product-card';
import { ShopUtilityBar } from '@/components/guest/ui/shop-utility-bar';
import { ShopFilterDrawer } from '@/components/guest/ui/shop-filter-drawer';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getGuestProducts,
  getProductFilters,
  type GuestProductsQuery,
} from '@/lib/api/guest-products';

export default function GuestProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Derive filter state from URL search params
  const currentPage = Number(searchParams?.get('page') || '1');
  const currentSort = searchParams?.get('sort') || 'newest';
  const currentCategory = searchParams?.get('category') || undefined;
  const currentEvent = searchParams?.get('event') || undefined;
  const currentColor = searchParams?.get('color') || undefined;
  const currentMinPrice = searchParams?.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const currentMaxPrice = searchParams?.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;

  // Calculate active filter count for the drawer (excluding category & sort)
  let activeFilterCount = 0;
  if (currentEvent) activeFilterCount++;
  if (currentColor) activeFilterCount++;
  if (currentMinPrice || currentMaxPrice) activeFilterCount++;

  // Build query object
  const query: GuestProductsQuery = {
    page: currentPage,
    limit: 20,
    sort: currentSort,
    category: currentCategory,
    event: currentEvent,
    color: currentColor,
    minPrice: currentMinPrice,
    maxPrice: currentMaxPrice,
  };

  // Fetch products
  const { data: productsData, isLoading, isError } = useQuery({
    queryKey: ['guest-products', query],
    queryFn: () => getGuestProducts(query),
  });

  // Fetch filter counts
  const { data: filtersData } = useQuery({
    queryKey: ['guest-product-filters'],
    queryFn: getProductFilters,
    staleTime: 60_000,
  });

  // URL updater
  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in updates)) params.delete('page');
    router.push(`/products?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleSortChange = (value: string) => updateParams({ sort: value });
  const handleFilterChange = (key: string, value: string | undefined) => updateParams({ [key]: value });
  const handleLoadMore = () => {
    if (productsData && currentPage < productsData.meta.pages) {
      updateParams({ page: String(currentPage + 1) });
    }
  };

  const products = productsData?.data || [];
  const meta = productsData?.meta;

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col bg-[#FCFCFC] relative pb-24 md:pb-0">
      {/* Mobile Floating Filter/Sort Pill */}
      {!drawerOpen && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center md:hidden animate-in slide-in-from-bottom-10 fade-in duration-500">
          <button 
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 whitespace-nowrap rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold tracking-wide text-white shadow-2xl transition-transform hover:scale-105"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter & Sort
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-900">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Utility Bar with Top Drawer */}
      <ShopUtilityBar
        categories={filtersData?.categories || []}
        activeCategory={currentCategory}
        currentSort={currentSort}
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
        drawerOpen={drawerOpen}
        activeFilterCount={activeFilterCount}
      />
      
      {/* Drawer Overlay Backdrop */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mega-menu style Top Drawer / Mobile Bottom Sheet */}
      {drawerOpen && (
        <div className="relative z-50 w-full">
          <div className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-full duration-300 md:absolute md:inset-x-0 md:top-0 md:bottom-auto md:max-h-[70vh] md:w-full md:rounded-none md:shadow-xl md:slide-in-from-top-4" style={{
            clipPath: 'inset(0 -100px -100px -100px)' 
          }}>
            <ShopFilterDrawer
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              filters={filtersData || null}
              activeEvent={currentEvent}
              activeColor={currentColor}
              activeMinPrice={currentMinPrice}
              activeMaxPrice={currentMaxPrice}
              currentSort={currentSort}
              onFilterChange={handleFilterChange}
              onSortChange={handleSortChange}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {currentCategory 
              ? filtersData?.categories.find(c => c.slug === currentCategory)?.name || 'Collection'
              : 'The Collection'}
          </h1>
          {meta && (
            <p className="mt-3 text-sm tracking-wide text-slate-500 uppercase">
              {meta.total} {meta.total === 1 ? 'piece' : 'pieces'} curated for you
            </p>
          )}
        </div>

        {/* Active Filter Chips */}
        {(currentEvent || currentColor || currentMinPrice || currentMaxPrice) && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Active Filters:</span>
            {currentEvent && (
              <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                {filtersData?.events?.find(e => e.slug === currentEvent)?.name || currentEvent}
                <button type="button" onClick={() => handleFilterChange('event', undefined)} className="text-slate-400 hover:text-slate-900">×</button>
              </span>
            )}
            {currentColor && (
              <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                {currentColor}
                <button type="button" onClick={() => handleFilterChange('color', undefined)} className="text-slate-400 hover:text-slate-900">×</button>
              </span>
            )}
            {(currentMinPrice || currentMaxPrice) && (
               <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                 {currentMinPrice ? `৳${currentMinPrice}` : '৳0'} - {currentMaxPrice ? `৳${currentMaxPrice}` : 'Max'}
                 <button type="button" onClick={() => { handleFilterChange('minPrice', undefined); handleFilterChange('maxPrice', undefined); }} className="text-slate-400 hover:text-slate-900">×</button>
               </span>
            )}
            <button
              type="button"
              onClick={() => updateParams({ event: undefined, color: undefined, minPrice: undefined, maxPrice: undefined })}
              className="ml-2 text-xs font-medium text-slate-500 underline transition-colors hover:text-slate-900"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Grid Area */}
        <div className="flex-1 mt-2">
          {isLoading && (
            <div className="grid grid-cols-2 gap-x-2 gap-y-6 md:gap-x-4 md:gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="animate-pulse bg-slate-100 aspect-[4/5] rounded-xl w-full" />
                  <div className="flex flex-col gap-2 px-1 py-1">
                    <div className="animate-pulse bg-slate-100 rounded h-3 w-3/4" />
                    <div className="animate-pulse bg-slate-100 rounded h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="flex min-h-[40vh] py-20 flex-col items-center justify-center text-center">
              <p className="mb-2 text-lg font-medium tracking-tight text-slate-900">Failed to load connection</p>
              <p className="text-sm text-slate-500">Please try refreshing the collection.</p>
            </div>
          )}

          {!isLoading && !isError && products.length === 0 && (
            <div className="flex min-h-[40vh] py-20 flex-col items-center justify-center text-center animate-in fade-in duration-500">
              <p className="mb-2 text-lg font-medium tracking-tight text-slate-900">No pieces found</p>
              <p className="text-sm text-slate-500 max-w-sm mb-6">Try adjusting your filters or search terms to uncover more styles.</p>
              <button 
                type="button" 
                onClick={() => updateParams({ category: undefined, event: undefined, color: undefined, minPrice: undefined, maxPrice: undefined })} 
                className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Clear all filters
              </button>
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-2 gap-y-6 md:gap-x-4 md:gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 animate-in fade-in duration-500">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    category={product.category?.name || ''}
                    eventNames={product.events?.map((e) => e.name)}
                    basePrice={product.rentalPrice || 0}
                    includedDays={product.includedDays}
                    imageUrl={
                      product.defaultVariant?.featuredImage?.thumbnailUrl ||
                      product.defaultVariant?.featuredImage?.url ||
                      ''
                    }
                    variants={
                      product.defaultVariant?.mainColor
                        ? [{ id: product.defaultVariant.id, name: product.defaultVariant.mainColor.name, colorHex: product.defaultVariant.mainColor.hexCode || undefined }]
                        : []
                    }
                    isAvailable={product.isAvailable}
                  />
                ))}
              </div>

              {meta && currentPage < meta.pages && (
                <div className="mt-16 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-medium tracking-wide text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
                  >
                    Discover More ({meta.total - products.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
