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
  imageUrl,
  variants = [],
  isAvailable = true,
}: ProductCardProps) {
  const { formatPrice } = useLocale();
  const [activeImage, setActiveImage] = useState(imageUrl);

  return (
    <div className="group relative flex flex-col gap-2 overflow-hidden bg-white p-2 transition-all hover:shadow-lg sm:p-3">
      {/* Image Container */}
      <Link href={`/products/${slug}`} className="relative block aspect-square overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImage || '/placeholder-product.jpg'}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {!isAvailable && (
          <div className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-xs font-bold text-white shadow">
            Booked
          </div>
        )}
      </Link>

      {/* Product Info */}
      <div className="flex flex-col gap-1">
        <Link href={`/products/${slug}`} className="group-hover:text-primary transition-colors">
          <h3 className="line-clamp-1 font-medium text-gray-900">{name}</h3>
        </Link>
        <div className="text-xs text-gray-500">
          {category}
          {eventNames && eventNames.length > 0 && ` · ${eventNames[0]}`}
        </div>
        <div className="mt-1 font-semibold text-gray-900">
          {formatPrice(basePrice)}{' '}
          <span className="text-xs font-normal text-gray-500">/ 3 days</span>
        </div>

        {/* Variants / Color Swatches */}
        {variants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={cn(
                  "h-4 w-4 rounded-full border border-gray-300 shadow-sm transition-transform hover:scale-125",
                  v.imageUrl === activeImage && "ring-1 ring-black ring-offset-1"
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
