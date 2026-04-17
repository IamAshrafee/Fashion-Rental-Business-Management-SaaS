import Link from 'next/link';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Variant {
  id: string;
  name: string;
  colorHex?: string;
  imageUrl?: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  category: string;
  eventNames?: string[];
  basePrice: number;
  includedDays?: number | null;
  imageUrl: string;
  variants?: Variant[];
  isAvailable?: boolean;
}

export function ProductCard({
  slug,
  name,
  category,
  eventNames,
  basePrice,
  includedDays,
  imageUrl,
  variants = [],
  isAvailable = true,
}: ProductCardProps) {
  const { formatPrice } = useLocale();
  const [activeImage, setActiveImage] = useState(imageUrl);

  const daysLabel = includedDays ? `${includedDays} days` : 'rental';

  return (
    <div className="group relative flex flex-col gap-3">
      {/* Image Container */}
      <div className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-slate-50 border border-slate-100 transition-all duration-300 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <Link href={`/products/${slug}`}>
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeImage}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <span className="text-xs uppercase tracking-wider">No Image</span>
            </div>
          )}
          {!isAvailable && (
            <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-800 shadow-sm backdrop-blur-md">
              Rented
            </div>
          )}
        </Link>
        
        {/* Quick Actions (Hover Reveal) */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 translate-y-4 items-center gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Link href={`/products/${slug}`} className="whitespace-nowrap rounded-full bg-white/95 px-6 py-2.5 text-xs font-semibold tracking-wide text-slate-900 shadow-sm backdrop-blur-md transition-transform hover:scale-105 hover:bg-white">
            Quick View
          </Link>
        </div>
      </div>

      {/* Product Info */}
      <div className="flex flex-col gap-1.5 px-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${slug}`} className="group-hover:text-primary transition-colors">
            <h3 className="line-clamp-1 text-sm font-medium text-gray-900">{name}</h3>
          </Link>
        </div>
        <div className="text-[11px] tracking-wide text-slate-500 uppercase">
          {category}
          {eventNames && eventNames.length > 0 && ` · ${eventNames[0]}`}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{formatPrice(basePrice)}</span>
          <span className="text-[11px] text-slate-500">/ {daysLabel}</span>
        </div>

        {/* Variants / Color Swatches */}
        {variants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={cn(
                  'h-4 w-4 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-110',
                  v.imageUrl === activeImage && 'ring-1 ring-black ring-offset-2',
                )}
                style={{ backgroundColor: v.colorHex || '#ccc' }}
                title={v.name}
                onClick={(e) => {
                  e.preventDefault();
                  if (v.imageUrl) setActiveImage(v.imageUrl);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
