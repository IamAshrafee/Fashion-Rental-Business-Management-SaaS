'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/guest/ui/product-card';
import { useTenant } from '@/hooks/use-tenant';
import { useLocale } from '@/hooks/use-locale';
import {
  getGuestProducts,
  getGuestCategories,
} from '@/lib/api/guest-products';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function GuestHomePage() {
  const { tenant } = useTenant();
  const { formatPrice } = useLocale();

  // Fetch featured products (newest, limited to 8)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['guest-home-products'],
    queryFn: () => getGuestProducts({ limit: 8, sort: 'newest' }),
    staleTime: 30_000,
  });

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['guest-categories'],
    queryFn: getGuestCategories,
    staleTime: 60_000,
  });

  const products = productsData?.data || [];
  const businessName = tenant?.businessName ?? 'Our Collection';

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {tenant?.tagline || `Premium Fashion Rentals`}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-300">
              {tenant?.about ||
                'Rent luxury fashion for your special occasions at a fraction of the retail price. Look stunning without the commitment.'}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-gray-100"
              >
                Browse Collection <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      {!categoriesLoading && categories && categories.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Shop by Category
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Find the perfect rental for your occasion
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg bg-gray-100 p-6 transition-all hover:shadow-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="relative z-10">
                  <h3 className="text-lg font-bold text-white">
                    {cat.name}
                  </h3>
                  {cat.subcategories.length > 0 && (
                    <p className="mt-1 text-xs text-gray-300">
                      {cat.subcategories.map((s) => s.name).join(', ')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Latest Arrivals
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Fresh additions to our rental collection
              </p>
            </div>
            <Link
              href="/products"
              className="hidden items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-black sm:flex"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {productsLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
              <p className="text-gray-500">
                No products available yet. Check back soon!
              </p>
            </div>
          ) : (
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
          )}

          <div className="mt-10 text-center sm:hidden">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 border border-black px-6 py-3 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
            >
              View All Products
            </Link>
          </div>
        </div>
      </section>

      {/* Why Rent CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Premium Quality',
              desc: 'Every piece is hand-curated and professionally maintained to ensure you look your absolute best.',
            },
            {
              title: 'Easy Process',
              desc: 'Browse, book, and receive. We handle delivery, and return pickup — hassle free.',
            },
            {
              title: 'Save More',
              desc: 'Wear designer fashion at a fraction of the retail price. The smartest way to dress up.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center text-center p-6"
            >
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
