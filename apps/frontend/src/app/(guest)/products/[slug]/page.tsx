'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useCart } from '@/hooks/use-cart';
import { useLocale } from '@/hooks/use-locale';
import { useAnalytics } from '@/providers/analytics-provider';
import {
  getProductBySlug,
  checkDateRange,
  type DateRangeCheck,
  type GuestProductDetail,
} from '@/lib/api/guest-products';
import {
  ChevronRight,
  Share2,
  Plus,
  Minus,
  Loader2,
  Check,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  Package,
  Ruler
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { CustomDateRangePicker } from './custom-date-picker';
import { CuratedPairingsSection } from './curated-pairings-section';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as any } },
};

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export default function GuestProductDetailPage() {
  const { slug } = useParams();
  const { formatPrice } = useLocale();
  const { addItem } = useCart();
  const { trackEvent } = useAnalytics();
  const { scrollYProgress } = useScroll();
  const scaleImage = useTransform(scrollYProgress, [0, 1], [1, 1.05]);

  const { data: rawProduct, isLoading, isError } = useQuery({
    queryKey: ['guest-product', slug],
    queryFn: () => getProductBySlug(slug as string),
    enabled: !!slug,
  });

  const product = (rawProduct && typeof rawProduct === 'object' && 'data' in rawProduct ? (rawProduct as any).data : rawProduct) as GuestProductDetail | undefined;


  // Custom date selection state
  const [date, setDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  const [addTryOn, setAddTryOn] = useState(false);
  const [addBackup, setAddBackup] = useState(false);
  const [selectedBackupSize, setSelectedBackupSize] = useState('M');
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [availabilityResult, setAvailabilityResult] = useState<DateRangeCheck | null>(null);

  const toggleAccordion = (id: string) => setOpenAccordion((prev) => (prev === id ? null : id));

  const availabilityMutation = useMutation({
    mutationFn: (params: { productId: string; startDate: string; endDate: string }) =>
      checkDateRange(params.productId, params.startDate, params.endDate),
    onSuccess: (data: any) => {
      const unwrapped = data && typeof data === 'object' && 'data' in data && 'success' in data ? data.data : data;
      setAvailabilityResult(unwrapped);
    },
    onError: () => setAvailabilityResult(null),
  });



  const [activeImage, setActiveImage] = useState(0);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Analytics: Track product view once per page load
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (product?.id && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackEvent('product_view', {
        productId: product.id,
        metadata: {
          productName: product.name,
          categoryName: product.category?.name,
          basePrice: product.pricing?.rentalPrice || product.pricing?.priceOverride || 0,
        }
      });
    }
  }, [product?.id, product?.name, product?.category?.name, trackEvent, product?.pricing?.rentalPrice, product?.pricing?.priceOverride]);

  useEffect(() => {
    setAvailabilityResult(null);
    if (date.from && date.to && product?.id) {
      if (date.to > date.from) {
        availabilityMutation.mutate({
          productId: product.id,
          startDate: format(date.from, 'yyyy-MM-dd'),
          endDate: format(date.to, 'yyyy-MM-dd'),
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.from, date.to, product?.id]);

  // 1. Group by unique colors to display the colour swatches
  const uniqueColors = useMemo(() => {
    if (!product?.variants) return [];
    const colorsMap = new Map();
    product.variants.forEach((v) => {
      if (v.mainColor && !colorsMap.has(v.mainColor.id)) {
        colorsMap.set(v.mainColor.id, v.mainColor);
      }
    });
    return Array.from(colorsMap.values());
  }, [product]);

  // 2. Initial state hydration
  useEffect(() => {
    if (uniqueColors.length > 0 && !selectedColorId) {
      setSelectedColorId(uniqueColors[0].id);
    }
  }, [uniqueColors, selectedColorId]);

  // 3. Filter variants belonging to the selected colour
  const colorVariants = useMemo(() => {
    if (!product?.variants || !selectedColorId) return [];
    return product.variants.filter((v) => v.mainColor?.id === selectedColorId);
  }, [product, selectedColorId]);

  // 4. Auto-select a valid sizing variant when color changes
  useEffect(() => {
    if (colorVariants.length > 0 && (!selectedVariantId || !colorVariants.some(v => v.id === selectedVariantId))) {
      setSelectedVariantId(colorVariants[0].id);
    }
  }, [colorVariants, selectedVariantId]);

  const selectedVariant = product?.variants?.find((v) => v.id === selectedVariantId);
  const pricing = product?.pricing;
  const services = product?.services;
  const sizing = product?.sizing; // new schema-driven sizing

  const allImages = useMemo(() => {
    if (!product?.variants) return [];
    return product.variants.flatMap((v) =>
      v.images.map((img) => ({
        ...img,
        variantId: v.id,
        colorName: v.mainColor?.name || 'Default',
      }))
    );
  }, [product]);

  const handleColorSelect = (colorId: string) => {
    setSelectedColorId(colorId);
    const primaryVariantForColor = product?.variants?.find(v => v.mainColor?.id === colorId);
    
    if (primaryVariantForColor?.images?.[0]) {
      const imgIdx = allImages.findIndex((img) => img.variantId === primaryVariantForColor.id && img.isFeatured);
      if (imgIdx !== -1) setActiveImage(imgIdx);
      else {
        const firstImg = allImages.findIndex((img) => img.variantId === primaryVariantForColor.id);
        if (firstImg !== -1) setActiveImage(firstImg);
      }
    }
  };

  const days = useMemo(() => {
    if (!date.from || !date.to) return 0;
    return date.to > date.from ? Math.ceil((date.to.getTime() - date.from.getTime()) / (1000 * 3600 * 24)) : 0;
  }, [date.from, date.to]);

  const rentalPrice = useMemo(() => {
    // If backend provided an exact authoritative quote, use its computed itemTotal/Base
    if (availabilityResult?.available && availabilityResult.pricing) {
      // The old expected variable "rentalPrice" translates to the pure rental cost
      return availabilityResult.pricing.baseRental + (availabilityResult.pricing.extendedCost || 0) + (availabilityResult.pricing.cleaningFee || 0);
    }
    
    // Fallback: when dates aren't selected yet, show the "Starting at" Base Price
    if (!pricing) return product?.headlinePricing?.price || 0;
    
    // Check headline pricing first
    if (product?.headlinePricing?.price) {
      return product.headlinePricing.price;
    }
    
    return pricing.priceOverride || (pricing.mode === 'percentage' ? pricing.calculatedPrice : null) || pricing.rentalPrice || pricing.pricePerDay || 0;
  }, [pricing, availabilityResult, product?.headlinePricing]);

  const depositAmount = (availabilityResult?.pricing?.deposit) ?? (services?.depositAmount || 0);
  const tryOnFee = addTryOn && services?.tryOnEnabled ? (services.tryOnFee || 0) : 0;
  const backupFee = addBackup && services?.backupSizeEnabled ? (services.backupSizeFee || 0) : 0;
  
  const totalPrice = useMemo(() => {
    if (availabilityResult?.available && availabilityResult.pricing) {
       // Backend `pricing.total` already includes Subtotal (Base + Extended + Cleaning) + Shipping
       return availabilityResult.pricing.total + depositAmount + tryOnFee + backupFee;
    }
    return rentalPrice + depositAmount + tryOnFee + backupFee;
  }, [availabilityResult, rentalPrice, depositAmount, tryOnFee, backupFee]);

  const hasSizes = colorVariants.some(v => v.sizeInstance !== null);
  const isSizeValid = !hasSizes || selectedVariantId !== null;

  const isFormValid = !!date.from && !!date.to && days > 0 && isSizeValid;
  const isAvailable = availabilityResult?.available !== false;
  const canAddToCart = isFormValid && isAvailable && !availabilityMutation.isPending;

  const handleAddToCart = () => {
    if (!canAddToCart || !product || !date.from || !date.to) return;
    
    // Analytics: Track add to cart
    trackEvent('add_to_cart', {
      productId: product.id,
      variantId: selectedVariant?.id,
      metadata: {
        productName: product.name,
        categoryName: product.category?.name,
        totalPrice,
        durationDays: days,
        addedServices: { tryOn: addTryOn, backupSize: addBackup },
      }
    });

    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      productName: product.name,
      categoryName: product.category?.name,
      featuredImage: allImages[activeImage]?.url || allImages[0]?.url,
      basePrice: availabilityResult?.pricing ? (availabilityResult.pricing.baseRental + availabilityResult.pricing.extendedCost) : rentalPrice,
      deposit: depositAmount,
      startDate: format(date.from, 'yyyy-MM-dd'),
      endDate: format(date.to, 'yyyy-MM-dd'),
      durationDays: days,
      selectedSize: selectedVariant?.sizeInstance?.displayLabel || undefined,
      serviceMap: {
        tryOn: addTryOn,
        backupSize: addBackup ? selectedBackupSize : null,
      },
      totalPrice,
    });
    try { toast.success(`Added ${product.name} to cart!`); } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}>
          <ShoppingBag className="h-10 w-10 text-black/20" />
        </motion.div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <AlertCircle className="mb-4 h-12 w-12 text-black/20" />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Product Not Found</h1>
        <p className="mb-6 text-gray-500">This item might have been archived.</p>
        <Link href="/products" className="rounded-full bg-black px-8 py-3.5 text-sm font-semibold tracking-wide text-white transition-transform hover:scale-105">
          Browse Collection
        </Link>
      </div>
    );
  }

  const effectiveBasePrice = pricing?.priceOverride || (pricing?.mode === 'percentage' ? pricing?.calculatedPrice : null) || pricing?.rentalPrice || 0;
  
  return (
    <div className="bg-white pb-32">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8 lg:px-12">
        {/* Breadcrumbs */}
        <motion.nav initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
          <Link href="/products" className="hover:text-black transition-colors">Products</Link>
          <ChevronRight className="mx-2 h-3.5 w-3.5 opacity-50" />
          {product.category && (
            <>
              <Link href={`/products?category=${product.category.slug}`} className="hover:text-black transition-colors">
                {product.category.name}
              </Link>
              <ChevronRight className="mx-2 h-3.5 w-3.5 opacity-50" />
            </>
          )}
          <span className="text-black line-clamp-1">{product.name}</span>
        </motion.nav>

        <div className="flex flex-col gap-12 lg:flex-row lg:items-start">
          
          {/* Left Column: Cinematic Gallery */}
          <div className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:w-[50%] xl:w-[55%]">
            <motion.div 
              layoutId={`product-image-${product.id}`}
              className="group relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-neutral-100"
            >
              <AnimatePresence mode="wait">
                {allImages[activeImage] ? (
                  <motion.img
                    key={activeImage}
                    src={allImages[activeImage].url}
                    alt={product.name}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ scale: scaleImage }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, { offset }) => {
                      const swipe = offset.x;
                      if (swipe < -60 && activeImage < allImages.length - 1) setActiveImage(a => a + 1);
                      else if (swipe > 60 && activeImage > 0) setActiveImage(a => a - 1);
                    }}
                    className="h-full w-full object-cover origin-bottom transition-transform duration-700 ease-out group-hover:scale-105 touch-pan-y"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package className="h-12 w-12 opacity-20" />
                  </div>
                )}
              </AnimatePresence>
              
              <div className="absolute right-6 top-6 flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 text-black shadow-lg backdrop-blur-md transition-colors hover:bg-white"
                  onClick={() => {
                    if (navigator.share) navigator.share({ title: product.name, url: window.location.href });
                    else { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </motion.button>
              </div>

              {allImages.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-xs font-medium tracking-widest text-white backdrop-blur-md">
                  {activeImage + 1} / {allImages.length}
                </div>
              )}
            </motion.div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex gap-3 overflow-x-auto pb-4 pt-2 no-scrollbar">
                {allImages.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      'relative aspect-[3/4] w-[80px] shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300',
                      activeImage === idx ? 'border-black shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumbnailUrl || img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Right Column: Details & Config */}
          <motion.div 
            variants={staggerChildren}
            initial="hidden"
            animate="visible"
            className="flex w-full flex-col lg:w-[50%] xl:w-[45%]"
          >
            {/* Header & Badges */}
            <motion.div variants={fadeInUp} className="mb-8">
              {product.events?.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {product.events.map((event) => (
                    <span key={event.id} className="rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-800">
                      {event.name}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="font-display text-3xl font-medium tracking-tight text-black sm:text-4xl lg:leading-[1.1]">
                {product.name}
              </h1>
              {product.category && (
                <p className="mt-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  {product.category.name} {product.subcategory && ` — ${product.subcategory.name}`}
                </p>
              )}
            </motion.div>

            {/* Inline Booking Configuration */}
            <motion.div id="booking-config" variants={fadeInUp} className="mb-10 flex flex-col gap-10 scroll-m-24">
              
              <div className="rounded-2xl bg-neutral-50/70 px-5 py-4 border border-black/5 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {isFormValid ? 'Total Rental Price' : 'Rental Price'}
                </span>
                <div className="flex items-end gap-2 tracking-tight">
                  <span className="text-3xl font-display font-medium leading-none text-black">
                    {formatPrice(isFormValid ? totalPrice : rentalPrice)}
                  </span>
                  {!isFormValid && (
                    <span className="mb-1.5 text-sm font-medium text-muted-foreground">
                      {product?.headlinePricing?.label || (() => {
                        const mode = product?.headlinePricing?.mode || pricing?.mode;
                        if (mode === 'per_day') return ' per day';
                        if (mode === 'flat') return pricing?.includedDays ? ` for ${pricing.includedDays} days` : ' flat rate';
                        if (mode === 'percentage') return ' of retail value';
                        if (mode === 'tiered') return ' / day (tiered)';
                        if (mode === 'weekly_monthly') return ' starting rate';
                        return '';
                      })()}
                    </span>
                  )}
                  {isFormValid && pricing?.includedDays && (
                    <span className="mb-1.5 text-sm font-medium text-muted-foreground">
                      / {pricing.includedDays} days included
                    </span>
                  )}
                </div>
              </div>

              {/* Date Picker */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-black/60">1. Timeline</h3>
                </div>
                <CustomDateRangePicker date={date} setDate={(d) => setDate(d || {from: undefined, to: undefined})} />

                {/* Availability Banner */}
                <AnimatePresence mode="popLayout">
                  {availabilityMutation.isPending && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center gap-3 rounded-xl bg-neutral-50 px-5 py-4 text-sm font-medium text-muted-foreground border border-neutral-100">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying dates internally...
                    </motion.div>
                  )}
                  {availabilityResult && isAvailable && days > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900 border border-emerald-100">
                      <span>Duration: <strong>{days} days</strong></span>
                      <span className="flex items-center gap-1.5"><Check className="h-5 w-5 text-emerald-600" /> Available</span>
                    </motion.div>
                  )}
                  {availabilityResult && !isAvailable && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center gap-3 rounded-xl bg-red-50 px-5 py-4 text-sm font-medium text-red-900 border border-red-100">
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                      Item unavailable for these dates.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Variants (Colors) */}
              {uniqueColors.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black/60">2. Color</h3>
                    <span className="text-sm font-medium text-black">
                      {uniqueColors.find(c => c.id === selectedColorId)?.name || 'Default'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {uniqueColors.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => handleColorSelect(color.id)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300',
                          selectedColorId === color.id ? 'border-black/50 scale-110 shadow-sm bg-white' : 'border-transparent hover:scale-105 bg-black/5 hover:bg-black/10'
                        )}
                      >
                        <span className="block h-7 w-7 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: color.hexCode || '#ccc' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sizing */}
              {sizing && colorVariants.some(v => v.sizeInstance !== null) && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black/60">3. Fit & Size</h3>
                    {sizing.sizeCharts && sizing.sizeCharts.length > 0 && (
                      <button onClick={() => setSizeGuideOpen(true)} className="text-xs font-semibold text-black underline underline-offset-4 hover:text-black/70">
                        Size Guide
                      </button>
                    )}
                  </div>
                  
                  {sizing.schema.definition && (sizing.schema.definition as any).ui?.selectorType === 'dropdown' && colorVariants.length > 12 ? (
                    <select 
                      value={selectedVariantId || ''} 
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full rounded-lg border border-black/10 bg-neutral-50 px-3 py-2.5 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black"
                    >
                      {colorVariants.map(v => (
                        <option key={v.id} value={v.id}>{v.sizeInstance?.displayLabel}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {colorVariants.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantId(v.id)}
                          className={cn(
                            'flex min-w-[3rem] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-300',
                            selectedVariantId === v.id 
                              ? 'border-black bg-black text-white shadow-md' 
                              : 'border-transparent bg-black/5 text-black hover:bg-black/10'
                          )}
                        >
                          {v.sizeInstance?.displayLabel || 'Default'}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {!isSizeValid && (
                     <p className="mt-2 text-xs font-medium text-red-500 tracking-wide">
                       Selection required
                     </p>
                  )}
                </div>
              )}

              {/* Extra Services */}
              {(services?.tryOnEnabled || services?.backupSizeEnabled) && (
                <div className="space-y-3">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-black/60">4. Premium Additions</h3>
                  
                  {services?.tryOnEnabled && (
                    <button
                      onClick={() => setAddTryOn(!addTryOn)}
                      className={cn(
                        'w-full text-left flex flex-col gap-1.5 rounded-xl border p-4 transition-all duration-300',
                        addTryOn ? 'border-black bg-neutral-50/50 shadow-md' : 'border-transparent bg-neutral-50 hover:bg-neutral-100 hover:border-black/5'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-2 font-semibold text-black">
                          <Sparkles className={cn("h-4 w-4", addTryOn ? "text-amber-500" : "text-muted-foreground")} />
                          At-Home Try On
                        </span>
                        <span className="font-bold">+{formatPrice(services.tryOnFee || 0)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        Garment arrives {services.tryOnDurationHours ? `${services.tryOnDurationHours}h` : '24h'} early for sizing test.
                        {services.tryOnCreditToRental && ' Fee is credited back.'}
                      </p>
                    </button>
                  )}

                  {services?.backupSizeEnabled && (
                    <div className={cn(
                      'overflow-hidden rounded-xl border transition-all duration-300',
                      addBackup ? 'border-black bg-neutral-50/50 shadow-md' : 'border-transparent bg-neutral-50 hover:bg-neutral-100 hover:border-black/5'
                    )}>
                      <button
                        onClick={() => setAddBackup(!addBackup)}
                        className="w-full text-left p-4 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-2 font-semibold text-black">
                            <Package className={cn("h-4 w-4", addBackup ? "text-amber-500" : "text-muted-foreground")} />
                            Backup Size Insurance
                          </span>
                          <span className="font-bold">+{formatPrice(services.backupSizeFee || 0)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-6">We'll ship a secondary size for perfect fitting.</p>
                      </button>
                      <AnimatePresence>
                        {addBackup && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-black/10 px-5 pb-5">
                            <div className="pt-4 pl-6">
                              <label className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-3 block">Backup Size Requirement</label>
                              <div className="flex flex-wrap gap-2">
                                {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => setSelectedBackupSize(s)}
                                    className={cn("px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all", selectedBackupSize === s ? "border-black bg-white shadow-sm" : "border-transparent bg-black/5 hover:bg-black/10 text-muted-foreground")}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}

              {/* Main Submit Button (Desktop) */}
              <button
                type="button"
                disabled={!canAddToCart}
                onClick={handleAddToCart}
                className={cn(
                  'relative hidden lg:flex w-full h-12 items-center justify-center overflow-hidden rounded-full text-sm font-bold uppercase tracking-widest text-white transition-all',
                  !canAddToCart ? 'bg-black/20 cursor-not-allowed' : 'bg-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20'
                )}
              >
                  {availabilityMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (canAddToCart ? 'Confirm Reservation' : (isSizeValid ? 'Select Dates' : 'Select Size'))}
              </button>
            </motion.div>
{/* Accordions */}
            <motion.div variants={fadeInUp} className="flex flex-col mb-16 lg:mb-0">
               {/* Description */}
               {product.description && (
                 <div className="border-b border-black/10 py-5">
                    <button onClick={() => toggleAccordion('desc')} className="flex w-full items-center justify-between text-left font-bold uppercase tracking-widest text-black">
                      The Story
                      {openAccordion === 'desc' ? <Minus className="h-4 w-4 opacity-50" /> : <Plus className="h-4 w-4 opacity-50" />}
                    </button>
                    <AnimatePresence>
                      {openAccordion === 'desc' && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <p className="pt-4 text-sm leading-loose text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
               )}



               {/* FAQs */}
               {product.faqs?.length > 0 && (
                 <div className="border-b border-black/10 py-5">
                    <button onClick={() => toggleAccordion('faqs')} className="flex w-full items-center justify-between text-left font-bold uppercase tracking-widest text-black">
                      Care & Facts
                      {openAccordion === 'faqs' ? <Minus className="h-4 w-4 opacity-50" /> : <Plus className="h-4 w-4 opacity-50" />}
                    </button>
                    <AnimatePresence>
                      {openAccordion === 'faqs' && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-6 pt-4">
                           {product.faqs.map(faq => (
                             <div key={faq.id}>
                               <h4 className="text-sm font-bold text-black">{faq.question}</h4>
                               <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                             </div>
                           ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
               )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      <CuratedPairingsSection categorySlug={product.category?.slug} currentProductId={product.id} />

      {/* Sticky Bottom Actions (Mobile focused) */}
      <motion.div 
         initial={{ y: 100 }}
         animate={{ y: 0 }}
         transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 30 }}
         className="fixed bottom-0 left-0 z-50 w-full border-t border-black/5 bg-white/90 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] backdrop-blur-xl md:p-6 lg:hidden"
      >
         <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-0 sm:px-4">
           <div className="flex flex-col">
             <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Checkout</span>
             <span className="text-2xl font-bold text-black leading-none">{formatPrice(isFormValid ? totalPrice : effectiveBasePrice)}</span>
           </div>
           
           <button
             type="button"
             disabled={!canAddToCart}
             onClick={() => {
               if (canAddToCart) {
                 handleAddToCart();
               } else {
                 const configElement = document.getElementById('booking-config');
                 if (configElement) {
                   configElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 } else {
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                 }
               }
             }}
             className={cn(
               "relative flex h-14 flex-1 max-w-[220px] items-center justify-center overflow-hidden rounded-full font-bold uppercase tracking-widest text-white transition-all",
               !canAddToCart ? 'bg-black/20 text-white/50 cursor-not-allowed' : 'bg-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20'
             )}
           >
               {availabilityMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (canAddToCart ? 'Reserve Now' : 'Select Details')}
           </button>
         </div>
      </motion.div>

      {/* Size Guide Modal Overlay */}
      {sizeGuideOpen && product?.sizing?.sizeCharts && (
        <Dialog open={sizeGuideOpen} onOpenChange={setSizeGuideOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                Size Guide & Measurements
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-8 max-h-[70vh] overflow-y-auto">
              {product.sizing.sizeCharts.map((chart: any) => (
                <div key={chart.id} className="overflow-x-auto rounded-xl border border-black/5 bg-neutral-50/50">
                  <div className="bg-muted px-4 py-3 border-b border-border">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-black flex items-center gap-2">
                      {chart.title}
                    </h4>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-black/5 bg-black/5">
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Size</th>
                          {chart.rows?.[0] && Object.keys(chart.rows[0].measurements || {}).map(key => (
                            <th key={key} className="px-4 py-3 text-left font-semibold text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.rows?.map((row: any) => (
                          <tr key={row.id} className="border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors">
                            <td className="px-4 py-4 font-bold text-black border-r border-black/5 bg-black/5">{row.sizeLabel}</td>
                            {Object.values(row.measurements || {}).map((val: any, i) => (
                              <td key={i} className="px-4 py-4 font-medium text-black/70">{String(val) || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 rounded-lg bg-orange-50 border border-orange-100 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 font-medium leading-relaxed">
                Measurements refer to body size, not garment dimensions. Need help? Contact our styling team for a personalized recommendation.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
