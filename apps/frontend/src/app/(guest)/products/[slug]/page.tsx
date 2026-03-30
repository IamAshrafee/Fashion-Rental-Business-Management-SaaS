'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useCart } from '@/hooks/use-cart';
import { useLocale } from '@/hooks/use-locale';
import {
  getProductBySlug,
  checkDateRange,
  type DateRangeCheck,
} from '@/lib/api/guest-products';
import {
  ChevronRight,
  Heart,
  Share2,
  Plus,
  Minus,
  Info,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function GuestProductDetailPage() {
  const { slug } = useParams();
  const { formatPrice } = useLocale();
  const { addItem } = useCart();

  // Fetch product from API
  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['guest-product', slug],
    queryFn: () => getProductBySlug(slug as string),
    enabled: !!slug,
  });

  // State
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [addTryOn, setAddTryOn] = useState(false);
  const [addBackup, setAddBackup] = useState(false);
  const [selectedBackupSize, setSelectedBackupSize] = useState('M');
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [availabilityResult, setAvailabilityResult] = useState<DateRangeCheck | null>(null);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  // Availability check mutation
  const availabilityMutation = useMutation({
    mutationFn: (params: { productId: string; startDate: string; endDate: string }) =>
      checkDateRange(params.productId, params.startDate, params.endDate),
    onSuccess: (data) => {
      setAvailabilityResult(data);
    },
    onError: () => {
      setAvailabilityResult(null);
    },
  });

  // Check availability when dates change
  const handleDateChange = useCallback(
    (type: 'start' | 'end', value: string) => {
      const newStart = type === 'start' ? value : startDate;
      const newEnd = type === 'end' ? value : endDate;

      if (type === 'start') setStartDate(value);
      if (type === 'end') setEndDate(value);

      // Reset availability when dates change
      setAvailabilityResult(null);

      // Auto-check if both dates are set
      if (newStart && newEnd && product?.id) {
        const start = new Date(newStart);
        const end = new Date(newEnd);
        if (end > start) {
          availabilityMutation.mutate({
            productId: product.id,
            startDate: newStart,
            endDate: newEnd,
          });
        }
      }
    },
    [startDate, endDate, product?.id, availabilityMutation],
  );

  // Derived data
  const selectedVariant = product?.variants?.[selectedVariantIdx];
  const pricing = product?.pricing;
  const services = product?.services;

  // All images from all variants (flattened)
  const allImages = useMemo(() => {
    if (!product?.variants) return [];
    return product.variants.flatMap((v) =>
      v.images.map((img) => ({
        ...img,
        variantId: v.id,
        colorName: v.mainColor?.name || 'Default',
      })),
    );
  }, [product]);

  const handleVariantSelect = (idx: number) => {
    setSelectedVariantIdx(idx);
    const variant = product?.variants?.[idx];
    if (variant?.images?.[0]) {
      const imgIdx = allImages.findIndex(
        (img) => img.variantId === variant.id && img.isFeatured,
      );
      if (imgIdx !== -1) setActiveImage(imgIdx);
      else {
        const firstImg = allImages.findIndex(
          (img) => img.variantId === variant.id,
        );
        if (firstImg !== -1) setActiveImage(firstImg);
      }
    }
  };

  // Pricing calculations
  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return end > start
      ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
      : 0;
  }, [startDate, endDate]);

  const rentalPrice = useMemo(() => {
    if (availabilityResult?.totalRentalPrice) {
      return availabilityResult.totalRentalPrice;
    }
    // Fallback: client-side estimate
    if (!pricing) return 0;
    const basePrice =
      pricing.priceOverride ||
      (pricing.mode === 'percentage' ? pricing.calculatedPrice : null) ||
      pricing.rentalPrice ||
      0;
    if (days === 0) return basePrice;
    const included = pricing.includedDays || 1;
    const extraDays = Math.max(0, days - included);
    const extRate = pricing.extendedRentalRate || pricing.pricePerDay || 0;
    return basePrice + extraDays * extRate;
  }, [pricing, days, availabilityResult]);

  const depositAmount = services?.depositAmount || 0;
  const tryOnFee = addTryOn && services?.tryOnEnabled ? (services.tryOnFee || 0) : 0;
  const backupFee = addBackup && services?.backupSizeEnabled ? (services.backupSizeFee || 0) : 0;
  const totalPrice = rentalPrice + depositAmount + tryOnFee + backupFee;

  const isFormValid = startDate !== '' && endDate !== '' && days > 0;
  const isAvailable = availabilityResult?.available !== false;
  const canAddToCart = isFormValid && isAvailable && !availabilityMutation.isPending;

  const handleAddToCart = () => {
    if (!canAddToCart || !product) return;

    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      productName: product.name,
      categoryName: product.category?.name,
      featuredImage: allImages[activeImage]?.url || allImages[0]?.url,
      basePrice: rentalPrice,
      deposit: depositAmount,
      startDate,
      endDate,
      durationDays: days,
      serviceMap: {
        tryOn: addTryOn,
        backupSize: addBackup ? selectedBackupSize : null,
      },
      totalPrice,
    });

    try {
      toast.success(`Added ${product.name} to cart!`);
    } catch {
      // toast may not be available — silent
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error / Not found
  if (isError || !product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <AlertCircle className="mb-4 h-12 w-12 text-gray-300" />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Product Not Found</h1>
        <p className="mb-6 text-gray-500">
          This product may have been removed or is not available.
        </p>
        <Link
          href="/products"
          className="bg-black px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white hover:bg-gray-800"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const effectiveBasePrice =
    pricing?.priceOverride ||
    (pricing?.mode === 'percentage' ? pricing?.calculatedPrice : null) ||
    pricing?.rentalPrice ||
    0;
  const includedDays = pricing?.includedDays || null;
  const extendedRate = pricing?.extendedRentalRate || pricing?.pricePerDay || 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center text-sm text-gray-500">
        <Link href="/products" className="hover:text-black">
          Products
        </Link>
        <ChevronRight className="mx-2 h-4 w-4" />
        {product.category && (
          <>
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-black"
            >
              {product.category.name}
            </Link>
            <ChevronRight className="mx-2 h-4 w-4" />
          </>
        )}
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="flex flex-col gap-12 lg:flex-row">
        {/* Left Col: Images */}
        <div className="flex w-full flex-col gap-4 lg:w-[55%]">
          {/* Main Image */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
            {allImages[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={allImages[activeImage].url}
                alt={product.name}
                className="h-full w-full object-cover transition-all"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                No Image
              </div>
            )}
            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-black shadow-sm backdrop-blur hover:bg-white"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: product.name,
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    try { toast.success('Link copied!'); } catch {}
                  }
                }}
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:gap-4 flex-nowrap overflow-x-auto no-scrollbar pb-2">
              {allImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={cn(
                    'relative aspect-[3/4] w-full overflow-hidden bg-gray-100 border-[2px] transition-all flex-shrink-0 min-w-[70px]',
                    activeImage === idx
                      ? 'border-black'
                      : 'border-transparent hover:border-gray-300',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbnailUrl || img.url}
                    alt={`Thumbnail ${idx}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Details + Config */}
        <div className="flex w-full flex-col lg:w-[45%]">
          {/* Events */}
          {product.events?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {product.events.map((event) => (
                <span
                  key={event.id}
                  className="bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-gray-700"
                >
                  {event.name}
                </span>
              ))}
            </div>
          )}

          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {product.name}
          </h1>
          {product.category && (
            <p className="mt-2 text-sm text-gray-500">
              {product.category.name}
              {product.subcategory && ` › ${product.subcategory.name}`}
            </p>
          )}

          {/* Pricing */}
          <div className="mt-6 flex flex-col">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold leading-none">
                {formatPrice(effectiveBasePrice)}
              </span>
              {includedDays && (
                <span className="mb-1 text-sm font-medium text-gray-500">
                  / {includedDays} days included
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              {extendedRate > 0 && (
                <span className="flex items-center gap-1">
                  <Plus className="h-3 w-3" /> {formatPrice(extendedRate)}
                  /extra day
                </span>
              )}
              {depositAmount > 0 && (
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3 text-orange-500" /> Deposit:{' '}
                  {formatPrice(depositAmount)}
                </span>
              )}
            </div>
          </div>

          <hr className="my-8 border-gray-200" />

          <div className="flex flex-col gap-8">
            {/* Variants */}
            {(product.variants?.length ?? 0) > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-gray-900">
                    Color
                  </h3>
                  <span className="text-sm text-gray-500">
                    {selectedVariant?.mainColor?.name || ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((variant, idx) => (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantSelect(idx)}
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all hover:scale-105',
                        selectedVariantIdx === idx
                          ? 'border-black p-0.5'
                          : 'border-transparent p-0',
                      )}
                    >
                      <span
                        className="h-full w-full rounded-full border border-black/10 shadow-inner"
                        style={{
                          backgroundColor:
                            variant.mainColor?.hexCode || '#ccc',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Information */}
            {product.productSize && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-gray-900">
                    {product.productSize.mode === 'free_size'
                      ? 'Size'
                      : 'Measurements'}
                  </h3>
                  {product.productSize.sizeChartUrl && (
                    <a
                      href={product.productSize.sizeChartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-500 underline hover:text-black"
                    >
                      Size Guide
                    </a>
                  )}
                </div>

                {product.productSize.mode === 'free_size' && (
                  <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 border border-gray-100">
                    {product.productSize.freeSizeType === 'one_size'
                      ? 'One Size Fits All'
                      : `Free Size — ${product.productSize.mainDisplaySize || 'Adjustable'}`}
                  </div>
                )}

                {product.productSize.mode === 'standard' &&
                  product.productSize.availableSizes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {product.productSize.availableSizes.map((size) => (
                        <span
                          key={size}
                          className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700"
                        >
                          {size}
                        </span>
                      ))}
                    </div>
                  )}

                {product.productSize.mode === 'measurement' &&
                  product.productSize.measurements.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-4 border border-gray-100">
                      {product.productSize.measurements.map((m) => (
                        <div key={m.id} className="flex flex-col">
                          <span className="text-xs uppercase text-gray-500">
                            {m.label}
                          </span>
                          <span className="font-medium text-gray-900">
                            {m.value} {m.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {product.productSize.mode === 'multi_part' &&
                  product.productSize.parts.length > 0 && (
                    <div className="space-y-3">
                      {product.productSize.parts.map((part) => (
                        <div key={part.id}>
                          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                            {part.partName}
                          </h4>
                          <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 border border-gray-100">
                            {part.measurements.map((m) => (
                              <div key={m.id} className="flex flex-col">
                                <span className="text-xs text-gray-400">
                                  {m.label}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {m.value} {m.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Date Selection */}
            <div>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-900">
                Rental Dates
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col">
                  <label className="mb-1 text-xs text-gray-500">
                    Pick-up Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-none border border-gray-300 bg-white p-3 text-sm focus:border-black focus:ring-0"
                    value={startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="flex flex-1 flex-col">
                  <label className="mb-1 text-xs text-gray-500">
                    Return Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-none border border-gray-300 bg-white p-3 text-sm focus:border-black focus:ring-0"
                    value={endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    min={
                      startDate || new Date().toISOString().split('T')[0]
                    }
                  />
                </div>
              </div>

              {/* Availability result */}
              {availabilityMutation.isPending && (
                <div className="mt-3 flex items-center gap-2 rounded bg-gray-50 px-4 py-2 text-sm text-gray-500 border border-gray-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking
                  availability...
                </div>
              )}
              {availabilityResult && isAvailable && days > 0 && (
                <div className="mt-3 flex items-center justify-between rounded bg-green-50 px-4 py-2 text-sm text-green-800 border border-green-200">
                  <span>
                    Duration: <strong>{days} days</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-4 w-4" /> Available
                  </span>
                </div>
              )}
              {availabilityResult && !isAvailable && (
                <div className="mt-3 flex items-center gap-2 rounded bg-red-50 px-4 py-2 text-sm text-red-700 border border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  Not available for these dates. Please try different dates.
                </div>
              )}
            </div>

            {/* Extra Services */}
            {(services?.tryOnEnabled || services?.backupSizeEnabled) && (
              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-900">
                  Enhance Your Experience
                </h3>

                {services?.tryOnEnabled && (
                  <label
                    className={cn(
                      'mb-3 flex cursor-pointer items-start gap-4 border p-4 transition-colors',
                      addTryOn
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="flex h-5 items-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5 border-gray-300 text-black focus:ring-black rounded shadow-sm"
                        checked={addTryOn}
                        onChange={(e) => setAddTryOn(e.target.checked)}
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium text-gray-900 flex justify-between">
                        Try before renting{' '}
                        <span>+{formatPrice(services.tryOnFee || 0)}</span>
                      </span>
                      <span className="mt-1 text-sm text-gray-500">
                        We send the dress{' '}
                        {services.tryOnDurationHours
                          ? `${services.tryOnDurationHours}h`
                          : '24h'}{' '}
                        in advance to ensure it fits perfectly.
                        {services.tryOnCreditToRental &&
                          ' Fee credited towards rental if you proceed.'}
                      </span>
                    </div>
                  </label>
                )}

                {services?.backupSizeEnabled && (
                  <label
                    className={cn(
                      'flex cursor-pointer border p-4 flex-col gap-3 transition-colors',
                      addBackup
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-5 items-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5 border-gray-300 text-black focus:ring-black rounded shadow-sm"
                          checked={addBackup}
                          onChange={(e) =>
                            setAddBackup(e.target.checked)
                          }
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span className="font-medium text-gray-900 flex justify-between">
                          Add backup size{' '}
                          <span>
                            +{formatPrice(services.backupSizeFee || 0)}
                          </span>
                        </span>
                        <span className="mt-1 text-sm text-gray-500">
                          Not sure about size? We&apos;ll send an extra one.
                        </span>
                      </div>
                    </div>

                    {addBackup && (
                      <div className="ml-9 border-t pt-3">
                        <select
                          className="w-full appearance-none rounded-none border border-gray-300 bg-white p-2 text-sm focus:border-black focus:ring-0"
                          value={selectedBackupSize}
                          onChange={(e) =>
                            setSelectedBackupSize(e.target.value)
                          }
                        >
                          <option value="S">Size S</option>
                          <option value="M">Size M</option>
                          <option value="L">Size L</option>
                          <option value="XL">Size XL</option>
                        </select>
                      </div>
                    )}
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Add To Cart */}
          <div className="fixed bottom-0 left-0 z-40 w-full border-t bg-white p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] md:relative md:z-auto md:mt-10 md:border-none md:p-0 md:shadow-none">
            <div className="mb-3 hidden justify-between text-sm md:flex">
              <span className="text-gray-500 items-center flex">
                Total Price (incl. deposit)
              </span>
              <span className="text-xl font-bold text-gray-900">
                {formatPrice(isFormValid ? totalPrice : effectiveBasePrice + depositAmount)}
              </span>
            </div>

            <button
              type="button"
              disabled={!canAddToCart}
              onClick={handleAddToCart}
              className={cn(
                'flex w-full items-center justify-center gap-2 bg-black py-4 px-8 text-base font-bold uppercase tracking-widest text-white transition-colors',
                !canAddToCart &&
                  'opacity-50 cursor-not-allowed hover:bg-black',
                canAddToCart && 'hover:bg-gray-800',
              )}
            >
              {availabilityMutation.isPending
                ? 'Checking...'
                : canAddToCart
                  ? `Add to Cart — ${formatPrice(totalPrice)}`
                  : 'Select Dates to Book'}
            </button>
          </div>

          <hr className="my-10 border-gray-200 hidden md:block" />

          {/* Description & Accordion Details */}
          <div className="mt-10 flex flex-col md:mt-0">
            {product.description && (
              <p className="text-gray-600 leading-relaxed text-sm mb-6">
                {product.description}
              </p>
            )}

            {/* FAQs */}
            {product.faqs?.length > 0 && (
              <div className="flex flex-col border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleAccordion('faqs')}
                  className="flex items-center justify-between py-4 text-left font-medium uppercase tracking-wide text-gray-900 hover:text-gray-600"
                >
                  Frequently Asked Questions
                  {openAccordion === 'faqs' ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
                {openAccordion === 'faqs' && (
                  <div className="pb-4 space-y-4">
                    {product.faqs.map((faq) => (
                      <div key={faq.id}>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {faq.question}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600">
                          {faq.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Detail Headers */}
            {product.details?.map((detail) => (
              <div
                key={detail.id}
                className="flex flex-col border-t border-gray-200"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(detail.id)}
                  className="flex items-center justify-between py-4 text-left font-medium uppercase tracking-wide text-gray-900 hover:text-gray-600"
                >
                  {detail.header}
                  {openAccordion === detail.id ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
                {openAccordion === detail.id && (
                  <div className="pb-4">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {detail.entries.map((entry) => (
                        <div key={entry.id} className="contents">
                          <dt className="text-gray-500">{entry.key}</dt>
                          <dd className="text-gray-900">{entry.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
