'use client';

import { useQuery } from '@tanstack/react-query';
import { getPopularByCategory, getPopularProducts } from '@/lib/api/guest-products';
import { ProductCard } from '@/components/guest/ui/product-card';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface CuratedPairingsSectionProps {
  categorySlug?: string;
  currentProductId: string;
}

export function CuratedPairingsSection({ categorySlug, currentProductId }: CuratedPairingsSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['curated-pairings', categorySlug],
    queryFn: () => categorySlug ? getPopularByCategory(categorySlug, 5) : getPopularProducts(5)
  });

  // Extract products from Showcase API format
  const rawProducts = data?.data || [];
  // Filter out the currently viewed product, and limit to exactly 4 items
  const products = rawProducts.filter(p => p.id !== currentProductId).slice(0, 4);

  if (isLoading) {
    return (
      <div className="flex w-full justify-center py-24 mt-10">
        <Loader2 className="h-6 w-6 animate-spin text-black/20" />
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="border-t border-black/5 py-16 lg:py-24 bg-white">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-12">
        <div className="mb-12 flex flex-col items-center text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-black sm:text-4xl">
            You Might Also Love
          </h2>
          <p className="mt-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Curated alternative styles
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-4 lg:gap-x-8"
        >
          {products.map((p) => {
            const variants = (p.variantCount > 0 && p.defaultVariant?.mainColor) ? [{
              id: p.defaultVariant.id,
              name: p.defaultVariant.mainColor.name,
              colorHex: p.defaultVariant.mainColor.hexCode || undefined,
              imageUrl: p.defaultVariant.featuredImage?.thumbnailUrl || p.defaultVariant.featuredImage?.url
            }] : [];

            return (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                category={p.category?.name || 'Apparel'}
                eventNames={p.events?.map(e => e.name)}
                basePrice={p.pricingMode === 'percentage' ? 0 : (p.rentalPrice || 0)}
                includedDays={p.includedDays}
                imageUrl={p.defaultVariant?.featuredImage?.url || ''}
                variants={variants}
                isAvailable={p.isAvailable}
              />
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
