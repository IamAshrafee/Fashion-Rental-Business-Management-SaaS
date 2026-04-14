'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/guest/ui/product-card';
import { useTenant } from '@/hooks/use-tenant';
import {
  getLatestArrivals,
  getPopularProducts,
  getPopularByCategory,
  getPopularBySubcategory,
  getPopularByEvent,
  getGuestCategories,
  type GuestProductCard,
} from '@/lib/api/guest-products';
import { ArrowRight, Loader2, TrendingUp, Sparkles, Tag, Layers, CalendarHeart } from 'lucide-react';

// ─── Shared ProductCard renderer ──────────────────────────────────────────────

function ProductGrid({ products }: { products: GuestProductCard[] }) {
  return (
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
  );
}

function SectionLoader() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function GuestHomePage() {
  const { tenant } = useTenant();

  // 1. Latest Arrivals
  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ['storefront', 'latest'],
    queryFn: () => getLatestArrivals(8),
    staleTime: 30_000,
  });

  // 2. Popular Products (overall)
  const { data: popularData, isLoading: popularLoading } = useQuery({
    queryKey: ['storefront', 'popular'],
    queryFn: () => getPopularProducts(8),
    staleTime: 30_000,
  });

  // 3. Popular by Category (auto-detect)
  const { data: byCategoryData, isLoading: byCategoryLoading } = useQuery({
    queryKey: ['storefront', 'popular-by-category'],
    queryFn: () => getPopularByCategory(undefined, 8),
    staleTime: 60_000,
  });

  // 4. Popular by Subcategory (auto-detect)
  const { data: bySubcategoryData, isLoading: bySubcategoryLoading } = useQuery({
    queryKey: ['storefront', 'popular-by-subcategory'],
    queryFn: () => getPopularBySubcategory(undefined, 8),
    staleTime: 60_000,
  });

  // 5. Popular by Event (auto-detect)
  const { data: byEventData, isLoading: byEventLoading } = useQuery({
    queryKey: ['storefront', 'popular-by-event'],
    queryFn: () => getPopularByEvent(undefined, 8),
    staleTime: 60_000,
  });

  // Categories for browsing
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['guest-categories'],
    queryFn: getGuestCategories,
    staleTime: 60_000,
  });

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

      {/* ── Section 1: Latest Arrivals ── */}
      <section className="bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            icon={<Sparkles className="h-5 w-5 text-amber-500" />}
            title="Latest Arrivals"
            subtitle="Fresh additions to our rental collection"
            linkHref="/products?sort=newest"
          />
          {latestLoading ? (
            <SectionLoader />
          ) : !latestData?.data?.length ? (
            <EmptyState message="No products available yet. Check back soon!" />
          ) : (
            <ProductGrid products={latestData.data} />
          )}
        </div>
      </section>

      {/* ── Section 2: Popular Products ── */}
      <section>
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            icon={<TrendingUp className="h-5 w-5 text-rose-500" />}
            title="Trending Now"
            subtitle="Most viewed and added to cart this month"
            linkHref="/products?sort=popularity"
          />
          {popularLoading ? (
            <SectionLoader />
          ) : !popularData?.data?.length ? (
            <EmptyState message="Not enough data to show trends yet." />
          ) : (
            <ProductGrid products={popularData.data} />
          )}
        </div>
      </section>

      {/* ── Section 3: Popular by Category (auto-detected) ── */}
      {!byCategoryLoading && byCategoryData?.category && byCategoryData.data.length > 0 && (
        <section className="bg-gray-50">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<Tag className="h-5 w-5 text-blue-500" />}
              title={`Popular in ${byCategoryData.category.name}`}
              subtitle={`Top picks from the ${byCategoryData.category.name} category`}
              linkHref={`/products?category=${byCategoryData.category.slug}`}
            />
            <ProductGrid products={byCategoryData.data} />
          </div>
        </section>
      )}

      {/* ── Section 4: Popular by Subcategory (auto-detected) ── */}
      {!bySubcategoryLoading && bySubcategoryData?.subcategory && bySubcategoryData.data.length > 0 && (
        <section>
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<Layers className="h-5 w-5 text-violet-500" />}
              title={`Popular in ${bySubcategoryData.subcategory.name}`}
              subtitle={`Best of ${bySubcategoryData.subcategory.name} from ${bySubcategoryData.subcategory.category.name}`}
              linkHref={`/products?subcategory=${bySubcategoryData.subcategory.slug}`}
            />
            <ProductGrid products={bySubcategoryData.data} />
          </div>
        </section>
      )}

      {/* ── Section 5: Popular by Event (auto-detected) ── */}
      {!byEventLoading && byEventData?.event && byEventData.data.length > 0 && (
        <section className="bg-gray-50">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<CalendarHeart className="h-5 w-5 text-pink-500" />}
              title={`Popular for ${byEventData.event.name}`}
              subtitle={`Top rentals for ${byEventData.event.name} occasions`}
              linkHref={`/products?event=${byEventData.event.slug}`}
            />
            <ProductGrid products={byEventData.data} />
          </div>
        </section>
      )}

      {/* ── Shop by Category ── */}
      {!categoriesLoading && categories && categories.length > 0 && (
        <section className={byEventData?.event ? '' : 'bg-gray-50'}>
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeader
              title="Shop by Category"
              subtitle="Find the perfect rental for your occasion"
            />
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
          </div>
        </section>
      )}

      {/* ── Why Rent CTA ── */}
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

// ─── Reusable Section Header ──────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  linkHref,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  linkHref?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <h2 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {icon}
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
      </div>
      {linkHref && (
        <Link
          href={linkHref}
          className="hidden items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-black sm:flex"
        >
          View All <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
