'use client';

import { useState } from 'react';
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function FilterSidebar({ mobileOpen, setMobileOpen }: FilterSidebarProps) {
  // Mobile drawer classes
  const mobileClasses = cn(
    'fixed inset-0 z-50 flex transform transition-transform duration-300 md:hidden',
    mobileOpen ? 'translate-x-0' : '-translate-x-full'
  );

  const [expandedSection, setExpandedSection] = useState<string | null>('category');

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const SidebarContent = (
    <div className="flex h-full w-80 max-w-[80vw] flex-col overflow-y-auto bg-white shadow-xl md:w-64 md:shadow-none">
      <div className="flex items-center justify-between border-b px-4 py-4 md:hidden">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <button onClick={() => setMobileOpen(false)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 md:p-0">
        <div className="hidden items-center justify-between pb-4 md:flex">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Filters</h2>
          <SlidersHorizontal className="h-4 w-4 text-gray-500" />
        </div>

        {/* Categories */}
        <div className="border-b py-4">
          <button 
            type="button"
            className="flex w-full items-center justify-between text-left font-medium text-gray-900" 
            onClick={() => toggleSection('category')}
          >
            Category
            <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSection === 'category' ? "rotate-180" : "")} />
          </button>
          
          {expandedSection === 'category' && (
             <div className="mt-4 flex flex-col gap-2">
               {['All', 'Saree (24)', 'Lehenga (18)', 'Gown (8)', 'Sherwani (12)'].map(cat => (
                 <label key={cat} className="flex cursor-pointer items-center gap-3">
                   <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black" />
                   <span className="text-sm text-gray-600 hover:text-black">{cat}</span>
                 </label>
               ))}
             </div>
          )}
        </div>

        {/* Price */}
        <div className="border-b py-4">
          <button 
            type="button"
            className="flex w-full items-center justify-between text-left font-medium text-gray-900" 
            onClick={() => toggleSection('price')}
          >
            Price Range
            <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSection === 'price' ? "rotate-180" : "")} />
          </button>
          
          {expandedSection === 'price' && (
             <div className="mt-4 flex flex-col gap-2">
               {['Under ৳2K', '৳2K - ৳5K', '৳5K - ৳10K', 'Over ৳10K'].map(price => (
                 <label key={price} className="flex cursor-pointer items-center gap-3">
                   <input type="radio" name="price" className="h-4 w-4 border-gray-300 text-black focus:ring-black" />
                   <span className="text-sm text-gray-600 hover:text-black">{price}</span>
                 </label>
               ))}
             </div>
          )}
        </div>

        {/* Color */}
        <div className="border-b py-4">
          <button 
            type="button"
            className="flex w-full items-center justify-between text-left font-medium text-gray-900" 
            onClick={() => toggleSection('color')}
          >
            Colors
            <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSection === 'color' ? "rotate-180" : "")} />
          </button>
          
          {expandedSection === 'color' && (
             <div className="mt-4 flex flex-wrap gap-2">
               {[
                 { bg: '#ffffff', border: 'border-gray-200' }, 
                 { bg: '#000000', border: 'border-black' },
                 { bg: '#ef4444', border: 'border-red-500' },
                 { bg: '#3b82f6', border: 'border-blue-500' },
                 { bg: '#22c55e', border: 'border-green-500' },
                 { bg: '#f97316', border: 'border-orange-500' }
               ].map((c, i) => (
                 <button 
                   key={i} 
                   type="button" 
                   className={cn("h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-110", c.border)}
                   style={{ backgroundColor: c.bg }} 
                 />
               ))}
             </div>
          )}
        </div>
      </div>

      <div className="mt-auto border-t p-4 md:hidden">
        <button 
          type="button"
          onClick={() => setMobileOpen(false)}
          className="w-full bg-black px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
        >
          View Results
        </button>
        <button type="button" className="mt-3 w-full text-sm font-medium text-gray-500 underline hover:text-black">
          Clear All
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden w-64 shrink-0 md:block">
        {SidebarContent}
      </div>

      <div className={mobileClasses}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
        {SidebarContent}
      </div>
    </>
  );
}
