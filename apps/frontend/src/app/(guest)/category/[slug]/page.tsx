'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  getGuestProducts,
  type GuestProductsQuery,
} from '@/lib/api/guest-products';
import { ProductCard } from '@/components/guest/ui/product-card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GuestCategoryPage() {
  const { slug } = useParams();
  const categorySlug = slug as string;

  const query: GuestProductsQuery = {
    category: categorySlug,
    limit: 40,
    sort: 'newest',
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['guest-category-products', categorySlug],
    queryFn: () => getGuestProducts(query),
    enabled: !!categorySlug,
  });

  const products = data?.data || [];
  const meta = data?.meta;
  const categoryName =
    products[0]?.category?.name ||
    categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-8">
        <Link
          href="/products"
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> All Products
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900">
          {categoryName}
        </h1>
        {meta && (
          <p className="mt-2 text-sm text-gray-500">
            {meta.total} {meta.total === 1 ? 'product' : 'products'} available
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="mb-2 text-lg font-medium text-gray-900">
            Failed to load products
          </p>
          <p className="text-sm text-gray-500">
            Please try refreshing the page.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && products.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="mb-2 text-lg font-medium text-gray-900">
            No products in this category
          </p>
          <p className="mb-6 text-sm text-gray-500">
            Check back soon or browse other categories.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 border border-black px-6 py-3 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
          >
            Browse All
          </Link>
        </div>
      )}

      {/* Product grid */}
      {!isLoading && products.length > 0 && (
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
              isAvailable={product.isAvailable}
            />
          ))}
        </div>
      )}

      {/* Pagination hint */}
      {meta && meta.pages > 1 && (
        <div className="mt-12 text-center">
          <Link
            href={`/products?category=${categorySlug}`}
            className="inline-block border border-black px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
          >
            View all with filters →
          </Link>
        </div>
      )}
    </div>
  );
}
