'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilterCounts } from '@/lib/api/guest-products';

interface ShopFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterCounts | null;
  activeEvent?: string;
  activeColor?: string;
  activeMinPrice?: number;
  activeMaxPrice?: number;
  currentSort: string;
  onFilterChange: (key: string, value: string | undefined) => void;
  onSortChange: (value: string) => void;
}

export function ShopFilterDrawer({
  isOpen,
  onClose,
  filters,
  activeEvent,
  activeColor,
  activeMinPrice,
  activeMaxPrice,
  currentSort,
  onFilterChange,
  onSortChange,
}: ShopFilterDrawerProps) {
  if (!isOpen) return null;

  const events = filters?.events || [];
  const priceRange = filters?.priceRange || { min: 0, max: 0 };
  const priceBuckets = priceRange.max > 0 ? buildPriceBuckets(priceRange.min, priceRange.max) : [];

  const handleClear = () => {
    onFilterChange('event', undefined);
    onFilterChange('color', undefined);
    onFilterChange('minPrice', undefined);
    onFilterChange('maxPrice', undefined);
  };

  return (
    <div className="w-full bg-slate-50 py-6 md:py-10 md:rounded-b-2xl md:border-b border-slate-200">
      {/* Mobile drag handle */}
      <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-slate-300 md:hidden" />
      
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium tracking-tight text-slate-900">Advanced Filters</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Sort Menu */}
        <div className="flex flex-col gap-4 md:hidden">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Sort By</h3>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {[
              { value: 'newest', label: 'Newest Arrivals' },
              { value: 'price_asc', label: 'Price: Low to High' },
              { value: 'price_desc', label: 'Price: High to Low' },
              { value: 'popularity', label: 'Most Popular' },
            ].map(sort => (
              <button 
                key={sort.value}
                type="button"
                onClick={() => onSortChange(sort.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap px-5 py-2 rounded-full border text-sm font-medium transition-colors", 
                  currentSort === sort.value ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Events / Occasions */}
          {events.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Occasion</h3>
              <div className="flex flex-col gap-2.5">
                {events.map((ev) => {
                  const isActive = activeEvent === ev.slug;
                  return (
                    <label key={ev.slug} className="group flex cursor-pointer items-center gap-3">
                      <div className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                        isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 group-hover:border-slate-500 bg-white"
                      )}>
                        {isActive && <Check className="h-3 w-3" />}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isActive}
                        onChange={() => onFilterChange('event', isActive ? undefined : ev.slug)}
                      />
                      <span className="text-sm text-slate-600 transition-colors group-hover:text-slate-900">
                        {ev.name} <span className="ml-1 text-slate-400">({ev.count})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Range */}
          {priceBuckets.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Price</h3>
              <div className="flex flex-col gap-2.5">
                <label className="group flex cursor-pointer items-center gap-3">
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                    !activeMinPrice && !activeMaxPrice ? "border-slate-900 border-[4px]" : "border-slate-300 group-hover:border-slate-500 bg-white"
                  )} />
                  <input
                    type="radio"
                    name="price"
                    className="sr-only"
                    checked={!activeMinPrice && !activeMaxPrice}
                    onChange={() => {
                      onFilterChange('minPrice', undefined);
                      onFilterChange('maxPrice', undefined);
                    }}
                  />
                  <span className="text-sm text-slate-600 transition-colors group-hover:text-slate-900">Any Price</span>
                </label>
                
                {priceBuckets.map((bucket) => {
                  const isActive = activeMinPrice === bucket.min && activeMaxPrice === bucket.max;
                  return (
                    <label key={bucket.label} className="group flex cursor-pointer items-center gap-3">
                      <div className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                        isActive ? "border-slate-900 border-[4px]" : "border-slate-300 group-hover:border-slate-500 bg-white"
                      )} />
                      <input
                        type="radio"
                        name="price"
                        className="sr-only"
                        checked={isActive}
                        onChange={() => {
                          onFilterChange('minPrice', bucket.min !== undefined ? String(bucket.min) : undefined);
                          onFilterChange('maxPrice', bucket.max !== undefined ? String(bucket.max) : undefined);
                        }}
                      />
                      <span className="text-sm text-slate-600 transition-colors group-hover:text-slate-900">{bucket.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drawer Actions */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Apply</h3>
            <div className="flex flex-col items-start gap-4 mt-2">
               <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold tracking-wide text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Show Results
               </button>
               <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm font-medium text-slate-500 underline transition-colors hover:text-slate-900"
               >
                 Clear Advanced Filters
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Price Bucket Builder ─────────────────────────────────────────────────────
function buildPriceBuckets(min: number, max: number): Array<{ label: string; min: number | undefined; max: number | undefined; }> {
  const buckets: Array<{ label: string; min: number | undefined; max: number | undefined; }> = [];
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
function formatK(n: number): string { return n >= 1000 ? `${n / 1000}K` : String(n); }
