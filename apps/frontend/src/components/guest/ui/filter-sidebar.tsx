'use client';

import { X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FilterCounts } from '@/lib/api/guest-products';

interface FilterSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  filters: FilterCounts | null;
  activeCategory?: string;
  activeEvent?: string;
  activeColor?: string;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  onFilterChange: (key: string, value: string | undefined) => void;
}

export function FilterSidebar({
  mobileOpen,
  setMobileOpen,
  filters,
  activeCategory,
  activeEvent,
  activeColor,
  activeMinPrice,
  activeMaxPrice,
  onFilterChange,
}: FilterSidebarProps) {
  const mobileClasses = cn(
    'fixed inset-0 z-50 flex transform transition-transform duration-300 md:hidden',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
  );

  const [expandedSection, setExpandedSection] = useState<string | null>(
    'category',
  );

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleClearAll = () => {
    onFilterChange('category', undefined);
    onFilterChange('event', undefined);
    onFilterChange('color', undefined);
    onFilterChange('minPrice', undefined);
    onFilterChange('maxPrice', undefined);
    setMobileOpen(false);
  };

  const categories = filters?.categories || [];
  const events = filters?.events || [];
  const priceRange = filters?.priceRange || { min: 0, max: 0 };

  // Build price range buckets from actual data
  const priceBuckets =
    priceRange.max > 0
      ? buildPriceBuckets(priceRange.min, priceRange.max)
      : [];

  const SidebarContent = (
    <div className="flex h-full w-80 max-w-[80vw] flex-col overflow-y-auto bg-white shadow-xl md:w-64 md:shadow-none">
      <div className="flex items-center justify-between border-b px-4 py-4 md:hidden">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 md:p-0">
        <div className="hidden items-center justify-between pb-4 md:flex">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
            Filters
          </h2>
          <SlidersHorizontal className="h-4 w-4 text-gray-500" />
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="border-b py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-gray-900"
              onClick={() => toggleSection('category')}
            >
              Category
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  expandedSection === 'category' ? 'rotate-180' : '',
                )}
              />
            </button>

            {expandedSection === 'category' && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="category"
                    className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                    checked={!activeCategory}
                    onChange={() => onFilterChange('category', undefined)}
                  />
                  <span className="text-sm text-gray-600 hover:text-black">
                    All Categories
                  </span>
                </label>
                {categories.map((cat) => (
                  <label
                    key={cat.slug}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <input
                      type="radio"
                      name="category"
                      className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                      checked={activeCategory === cat.slug}
                      onChange={() => onFilterChange('category', cat.slug)}
                    />
                    <span className="text-sm text-gray-600 hover:text-black">
                      {cat.name}{' '}
                      <span className="text-gray-400">({cat.count})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events */}
        {events.length > 0 && (
          <div className="border-b py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-gray-900"
              onClick={() => toggleSection('event')}
            >
              Occasion
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  expandedSection === 'event' ? 'rotate-180' : '',
                )}
              />
            </button>

            {expandedSection === 'event' && (
              <div className="mt-4 flex flex-col gap-2">
                {events.map((ev) => (
                  <label
                    key={ev.slug}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                      checked={activeEvent === ev.slug}
                      onChange={() =>
                        onFilterChange(
                          'event',
                          activeEvent === ev.slug ? undefined : ev.slug,
                        )
                      }
                    />
                    <span className="text-sm text-gray-600 hover:text-black">
                      {ev.name}{' '}
                      <span className="text-gray-400">({ev.count})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Price */}
        {priceBuckets.length > 0 && (
          <div className="border-b py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-gray-900"
              onClick={() => toggleSection('price')}
            >
              Price Range
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  expandedSection === 'price' ? 'rotate-180' : '',
                )}
              />
            </button>

            {expandedSection === 'price' && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="price"
                    className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                    checked={!activeMinPrice && !activeMaxPrice}
                    onChange={() => {
                      onFilterChange('minPrice', undefined);
                      onFilterChange('maxPrice', undefined);
                    }}
                  />
                  <span className="text-sm text-gray-600 hover:text-black">
                    Any Price
                  </span>
                </label>
                {priceBuckets.map((bucket) => (
                  <label
                    key={bucket.label}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <input
                      type="radio"
                      name="price"
                      className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                      checked={
                        activeMinPrice === bucket.min &&
                        activeMaxPrice === bucket.max
                      }
                      onChange={() => {
                        onFilterChange(
                          'minPrice',
                          bucket.min !== undefined
                            ? String(bucket.min)
                            : undefined,
                        );
                        onFilterChange(
                          'maxPrice',
                          bucket.max !== undefined
                            ? String(bucket.max)
                            : undefined,
                        );
                      }}
                    />
                    <span className="text-sm text-gray-600 hover:text-black">
                      {bucket.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto border-t p-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="w-full bg-black px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
        >
          View Results
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          className="mt-3 w-full text-sm font-medium text-gray-500 underline hover:text-black"
        >
          Clear All
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden w-64 shrink-0 md:block">{SidebarContent}</div>

      <div className={mobileClasses}>
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
        {SidebarContent}
      </div>
    </>
  );
}

// ─── Price Bucket Builder ─────────────────────────────────────────────────────

function buildPriceBuckets(
  min: number,
  max: number,
): Array<{
  label: string;
  min: number | undefined;
  max: number | undefined;
}> {
  const buckets: Array<{
    label: string;
    min: number | undefined;
    max: number | undefined;
  }> = [];

  // Generate reasonable buckets based on the price range
  const steps = [1000, 2000, 5000, 10000, 20000, 50000];
  let prev = 0;

  for (const step of steps) {
    if (step > max) break;
    if (step > min) {
      buckets.push({
        label: prev === 0 ? `Under ৳${formatK(step)}` : `৳${formatK(prev)} – ৳${formatK(step)}`,
        min: prev === 0 ? undefined : prev,
        max: step,
      });
    }
    prev = step;
  }

  if (prev < max) {
    buckets.push({
      label: `Over ৳${formatK(prev)}`,
      min: prev,
      max: undefined,
    });
  }

  return buckets;
}

function formatK(n: number): string {
  return n >= 1000 ? `${n / 1000}K` : String(n);
}
