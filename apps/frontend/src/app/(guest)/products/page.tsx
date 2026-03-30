'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/guest/ui/product-card';
import { FilterSidebar } from '@/components/guest/ui/filter-sidebar';
import { SlidersHorizontal, ChevronDown, Loader2 } from 'lucide-react';
import {
  getGuestProducts,
  getProductFilters,
  type GuestProductsQuery,
  type FilterCounts,
} from '@/lib/api/guest-products';

export default function GuestProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Derive filter state from URL search params
  const currentPage = Number(searchParams?.get('page') || '1');
  const currentSort = searchParams?.get('sort') || 'newest';
  const currentCategory = searchParams?.get('category') || undefined;
  const currentEvent = searchParams?.get('event') || undefined;
  const currentColor = searchParams?.get('color') || undefined;
  const currentMinPrice = searchParams?.get('minPrice')
    ? Number(searchParams.get('minPrice'))
    : undefined;
  const currentMaxPrice = searchParams?.get('maxPrice')
    ? Number(searchParams.get('maxPrice'))
    : undefined;

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
  const {
    data: productsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['guest-products', query],
    queryFn: () => getGuestProducts(query),
  });

  // Fetch filter counts
  const { data: filtersData } = useQuery({
    queryKey: ['guest-product-filters'],
    queryFn: getProductFilters,
    staleTime: 60_000, // cache for 1 min
  });

  // URL updater
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Reset to page 1 when filters change (unless we're specifically setting page)
      if (!('page' in updates)) {
        params.delete('page');
      }
      router.push(`/products?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const handleSortChange = (value: string) => {
    updateParams({ sort: value });
  };

  const handleFilterChange = (
    key: string,
    value: string | undefined,
  ) => {
    updateParams({ [key]: value });
  };

  const handleLoadMore = () => {
    if (productsData && currentPage < productsData.meta.pages) {
      updateParams({ page: String(currentPage + 1) });
    }
  };

  const products = productsData?.data || [];
  const meta = productsData?.meta;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900">
            All Products
          </h1>
          {meta && (
            <p className="text-sm text-gray-500">
              Showing {products.length} of {meta.total} results
            </p>
          )}
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
              <select
                className="appearance-none rounded-none border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 outline-none focus:border-black focus:ring-0"
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="popularity">Most Popular</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:gap-8">
        {/* Sidebar wrapper */}
        <FilterSidebar
          mobileOpen={mobileFilterOpen}
          setMobileOpen={setMobileFilterOpen}
          filters={filtersData || null}
          activeCategory={currentCategory}
          activeEvent={currentEvent}
          activeColor={currentColor}
          activeMinPrice={currentMinPrice}
          activeMaxPrice={currentMaxPrice}
          onFilterChange={handleFilterChange}
        />

        {/* Products Grid */}
        <div className="flex-1">
          {/* Active filter pills */}
          {(currentCategory || currentEvent || currentColor) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {currentCategory && (
                <span className="flex items-center gap-1 rounded-full border border-black bg-black px-3 py-1.5 text-xs font-medium text-white">
                  {currentCategory}
                  <button
                    type="button"
                    onClick={() => handleFilterChange('category', undefined)}
                    className="ml-1 hover:text-gray-300"
                  >
                    ×
                  </button>
                </span>
              )}
              {currentEvent && (
                <span className="flex items-center gap-1 rounded-full border border-black bg-black px-3 py-1.5 text-xs font-medium text-white">
                  {currentEvent}
                  <button
                    type="button"
                    onClick={() => handleFilterChange('event', undefined)}
                    className="ml-1 hover:text-gray-300"
                  >
                    ×
                  </button>
                </span>
              )}
              {currentColor && (
                <span className="flex items-center gap-1 rounded-full border border-black bg-black px-3 py-1.5 text-xs font-medium text-white">
                  {currentColor}
                  <button
                    type="button"
                    onClick={() => handleFilterChange('color', undefined)}
                    className="ml-1 hover:text-gray-300"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  updateParams({
                    category: undefined,
                    event: undefined,
                    color: undefined,
                    minPrice: undefined,
                    maxPrice: undefined,
                  })
                }
                className="text-xs font-medium text-gray-500 underline hover:text-black"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
              <p className="mb-2 text-lg font-medium text-gray-900">
                Failed to load products
              </p>
              <p className="text-sm text-gray-500">
                Please try refreshing the page.
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && products.length === 0 && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
              <p className="mb-2 text-lg font-medium text-gray-900">
                No products found
              </p>
              <p className="text-sm text-gray-500">
                Try changing your filters or search terms.
              </p>
            </div>
          )}

          {/* Product Grid */}
          {!isLoading && products.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
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
                        ? [
                            {
                              id: product.defaultVariant.id,
                              name: product.defaultVariant.mainColor.name,
                              colorHex:
                                product.defaultVariant.mainColor.hexCode ||
                                undefined,
                            },
                          ]
                        : []
                    }
                    isAvailable={product.isAvailable}
                  />
                ))}
              </div>

              {/* Load More / Pagination */}
              {meta && currentPage < meta.pages && (
                <div className="mt-12 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    className="inline-block border border-black bg-transparent px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
                  >
                    Load More ({meta.total - products.length} remaining)
                  </button>
                </div>
              )}

              {/* Page indicator */}
              {meta && meta.pages > 1 && (
                <p className="mt-4 text-center text-xs text-gray-400">
                  Page {meta.page} of {meta.pages}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
