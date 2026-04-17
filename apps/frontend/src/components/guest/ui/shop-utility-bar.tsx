'use client';

import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryScore {
  slug: string;
  name: string;
  count: number;
}

interface ShopUtilityBarProps {
  categories: CategoryScore[];
  activeCategory?: string;
  currentSort: string;
  onFilterChange: (key: string, value: string | undefined) => void;
  onSortChange: (value: string) => void;
  onToggleDrawer: () => void;
  drawerOpen: boolean;
  activeFilterCount: number;
}

export function ShopUtilityBar({
  categories,
  activeCategory,
  currentSort,
  onFilterChange,
  onSortChange,
  onToggleDrawer,
  drawerOpen,
  activeFilterCount,
}: ShopUtilityBarProps) {
  return (
    <div className="sticky top-16 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center lg:px-8">
        {/* Category Pills (Quick Filters) */}
        <div 
          className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 md:w-auto md:pb-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onFilterChange('category', isActive ? undefined : cat.slug)}
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'border-transparent bg-slate-900 text-white shadow-md'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Global Utilities (Desktop Only) */}
        <div className="hidden w-full items-center justify-between gap-4 md:flex md:w-auto">
          {/* Main Filter Toggle */}
          <button
            type="button"
            onClick={onToggleDrawer}
            className={cn(
              'flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-colors',
              drawerOpen
                ? 'border-slate-900 bg-slate-50 text-slate-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                'ml-1 h-3.5 w-3.5 transition-transform',
                drawerOpen && 'rotate-180',
              )}
            />
          </button>

          {/* Elegant Sort Dropdown */}
          <div className="relative flex items-center gap-2">
            <span className="hidden text-sm text-gray-500 sm:inline">Sort by:</span>
            <div className="relative">
              <select
                className="appearance-none rounded-full border border-gray-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-gray-300 focus:border-slate-900 focus:ring-0"
                value={currentSort}
                onChange={(e) => onSortChange(e.target.value)}
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="popularity">Most Popular</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
