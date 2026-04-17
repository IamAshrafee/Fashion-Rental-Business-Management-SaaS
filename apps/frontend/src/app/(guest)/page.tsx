'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/guest/ui/product-card';
import { RentalJourneySection } from '@/components/guest/ui/rental-journey-section';
import { CustomerExperienceSection } from '@/components/guest/ui/customer-experience-section';
import { ExclusiveInvitationCTA } from '@/components/guest/ui/exclusive-invitation-cta';
import { useTenant } from '@/hooks/use-tenant';
import {
  getLatestArrivals,
  getPopularByCategory,
  getPopularBySubcategory,
  getPopularByEvent,
  getGuestCategories,
  type GuestProductCard,
} from '@/lib/api/guest-products';
import { ArrowRight, Loader2, Sparkles, Tag, Layers, CalendarHeart } from 'lucide-react';

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
      {/* Hero Section - Editorial Arrival */}
      <section className="relative overflow-hidden bg-white selection:bg-brand-100 selection:text-brand-900">
        {/* Animated glowing modern background elements */}
        <div className="absolute -left-[10%] top-0 h-[300px] w-[300px] animate-pulse rounded-full bg-brand-200/40 mix-blend-multiply blur-3xl filter md:h-[500px] md:w-[500px]" style={{ animationDuration: '4s' }} />
        <div className="absolute -right-[10%] top-[20%] h-[200px] w-[200px] animate-pulse rounded-full bg-rose-200/30 mix-blend-multiply blur-3xl filter md:h-[400px] md:w-[400px]" style={{ animationDuration: '6s' }} />

        {/* min-h to fit mostly in one screen, centering vertically */}
        <div className="relative mx-auto flex min-h-[90vh] max-w-7xl items-center px-4 py-16 sm:px-6 md:min-h-[calc(100vh-5rem)] md:py-24 lg:px-8">
          <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
            
            {/* Left Content (Order 2 on mobile, Order 1 on Desktop to keep image above text on mobile) */}
            <div className="order-2 flex max-w-2xl flex-col justify-center pr-4 lg:order-1 animate-fade-in relative z-10">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-px w-8 bg-brand-200"></span>
                <span className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  The Premium Edit
                </span>
              </div>
              
              {/* Zoom-proof clamp typography */}
              <h1 className="font-editorial leading-[0.95] tracking-tight text-gray-900 text-[clamp(2.75rem,8vw,5.5rem)]">
                {tenant?.tagline || (
                  <>
                    Own the <br className="hidden sm:block" /> Moment, <br className="hidden sm:block" />
                    <span className="italic text-gray-400">Not the Dress.</span>
                  </>
                )}
              </h1>
              
              <p className="mt-8 max-w-lg font-sans text-[clamp(1rem,2vw,1.25rem)] font-light leading-relaxed text-gray-600">
                {tenant?.about ||
                  'Discover curated designer pieces delivered directly to your door. Wear it, love it, return it. The smartest way to dress up.'}
              </p>
              
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/products"
                  className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-black px-8 py-4 font-sans text-[clamp(0.875rem,1.5vw,1rem)] font-medium uppercase tracking-widest text-white transition-all hover:bg-gray-800 hover:shadow-xl hover:shadow-black/10"
                >
                  <span className="relative z-10 font-bold">Shop Collection</span>
                  <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Right Visual Image (Order 1 on mobile, Order 2 on Desktop) */}
            <div className="order-1 relative animate-fade-in lg:order-2 [animation-delay:150ms] z-10">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-2xl shadow-brand-500/5 sm:rounded-3xl lg:aspect-[4/5]">
                <img
                  src="https://images.unsplash.com/photo-1515347619362-e6fdcee1c56a?q=80&w=1200&auto=format&fit=crop"
                  alt="Premium fashion collection showcase"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60 mix-blend-multiply"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Curated Pathways (Post-Hero Editorial Masonry) ── */}
      {!categoriesLoading && (
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 lg:mb-16">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Explore
              </span>
              <h2 className="font-editorial mt-2 text-4xl leading-none tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                Curated for the Moment
              </h2>
            </div>

            {/* Layout: Assymetrical Grid Desktop / Snap Carousel Mobile */}
            <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto pb-8 scrollbar-hide lg:grid lg:grid-cols-12 lg:gap-6 lg:overflow-visible lg:pb-0">
              
              {/* Featured / Hero Category (Left side large block) */}
              <div className="relative w-[85vw] shrink-0 snap-center lg:col-span-7 lg:w-auto">
                <Link href={`/products?category=${categories?.[0]?.slug || 'bridal'}`} className="group block h-[450px] w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-[600px] lg:h-[700px]">
                  <img 
                    src="https://images.unsplash.com/photo-1550614000-4b95d4edfa22?q=80&w=1000&auto=format&fit=crop" 
                    alt={categories?.[0]?.name || "The Bridal Edit"}
                    className="h-full w-full object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-70 transition-opacity duration-700 group-hover:opacity-90"></div>
                  
                  <div className="absolute inset-0 flex flex-col justify-between p-8 sm:p-12">
                    <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-3 py-1 font-sans text-xs font-semibold tracking-wider text-white backdrop-blur-md">
                      Trending
                    </span>
                    <div className="transform transition-transform duration-500 ease-out group-hover:-translate-y-2">
                      <h3 className="font-display text-3xl font-medium text-white sm:text-5xl">{categories?.[0]?.name || "The Bridal Edit"}</h3>
                      <p className="mt-4 flex items-center gap-2 font-sans text-sm font-medium uppercase tracking-widest text-white/0 transition-all duration-500 group-hover:text-white/100">
                        Shop Collection <ArrowRight className="h-4 w-4" />
                      </p>
                    </div>
                  </div>
                </Link>
              </div>

              {/* Secondary Categories (Right side) */}
              <div className="flex w-[85vw] shrink-0 snap-center flex-col gap-4 lg:col-span-5 lg:w-auto lg:gap-6">
                
                {/* Secondary A */}
                <Link href={`/products?category=${categories?.[1]?.slug || 'gala'}`} className="group relative block h-[217px] w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-[288px] lg:h-[338px]">
                  <img 
                    src="https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?q=80&w=800&auto=format&fit=crop" 
                    alt={categories?.[1]?.name || "Gala Ready"}
                    className="h-full w-full object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-70 transition-opacity duration-700 group-hover:opacity-90"></div>
                  <div className="absolute bottom-0 left-0 p-6 sm:p-8 transform transition-transform duration-500 ease-out group-hover:-translate-y-1">
                    <h3 className="font-display text-2xl font-medium text-white sm:text-3xl">{categories?.[1]?.name || "Gala Ready"}</h3>
                    <p className="mt-2 flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-widest text-white/0 transition-all duration-500 group-hover:text-white/100">
                      Explore <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                </Link>
                
                {/* Secondary B */}
                <Link href={`/products?category=${categories?.[2]?.slug || 'new-arrivals'}`} className="group relative block h-[217px] w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-[288px] lg:h-[338px]">
                  <img 
                    src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop" 
                    alt={categories?.[2]?.name || "New Arrivals"}
                    className="h-full w-full object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-70 transition-opacity duration-700 group-hover:opacity-90"></div>
                  <div className="absolute bottom-0 left-0 p-6 sm:p-8 transform transition-transform duration-500 ease-out group-hover:-translate-y-1">
                    <h3 className="font-display text-2xl font-medium text-white sm:text-3xl">{categories?.[2]?.name || "New Arrivals"}</h3>
                    <p className="mt-2 flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-widest text-white/0 transition-all duration-500 group-hover:text-white/100">
                      Explore <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                </Link>

              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Rental Journey Section (Educational storytelling) ── */}
      <RentalJourneySection />

      {/* ── Section 1: Latest Arrivals (Gallery Window Concept) ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between border-b border-gray-100 pb-6 lg:mb-16">
            <div>
              <h2 className="font-editorial text-4xl leading-none tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                Arriving Now
              </h2>
              <p className="mt-4 font-sans text-sm text-gray-500 uppercase tracking-widest">
                Fresh additions to the gallery
              </p>
            </div>
            <Link
              href="/products?sort=newest"
              className="group hidden items-center gap-2 font-sans text-sm font-medium uppercase tracking-widest text-gray-900 transition-colors hover:text-gray-500 sm:flex"
            >
              View Gallery <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {latestLoading ? (
            <SectionLoader />
          ) : !latestData?.data?.length ? (
            <EmptyState message="No new additions yet. The gallery is preparing something special." />
          ) : (
            <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto pb-8 scrollbar-hide lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:pb-0">
              {latestData.data.slice(0, 4).map((product) => (
                <div key={product.id} className="group relative w-[75vw] shrink-0 snap-start lg:w-auto">
                  <Link href={`/products/${product.slug}`} className="block">
                    {/* The Image Stack */}
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gray-50">
                      <img
                        src={product.defaultVariant?.featuredImage?.url || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800"}
                        alt={product.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1500ms] group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Subcategory / Quick Add overlay */}
                      <div className="absolute inset-0 bg-transparent transition-all duration-500 group-hover:bg-black/10"></div>
                      
                      {/* Floating Badge */}
                      <div className="absolute left-4 top-4">
                        <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-black backdrop-blur-md shadow-sm">
                          New
                        </span>
                      </div>
                      
                      {/* Quick View slide-up button */}
                      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 translate-y-4 items-center justify-center rounded-full bg-black/90 px-6 py-3 font-sans text-xs font-semibold uppercase tracking-widest text-white opacity-0 backdrop-blur-md transition-all duration-500 hover:bg-black group-hover:translate-y-0 group-hover:opacity-100 shadow-xl w-[85%]">
                        Quick Reserve
                      </div>
                    </div>

                    {/* Meta Row (Minimal) */}
                    <div className="mt-5 flex items-start justify-between">
                      <div>
                        <h3 className="font-sans text-sm font-medium text-gray-900 group-hover:underline overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{product.name}</h3>
                        <p className="mt-1 font-sans text-xs text-brand-600 uppercase tracking-widest">
                          {product.category?.name || "Premium Wear"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-sm font-semibold text-gray-900">${product.rentalPrice}</p>
                        <p className="mt-1 font-sans text-[10px] text-gray-400 font-medium">★ 5.0</p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
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

      {/* ── Customer Experience / The Wardrobe Diaries ── */}
      <CustomerExperienceSection />

      {/* ── Final Conversion Push (Exclusive Invitation) ── */}
      <ExclusiveInvitationCTA />
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
