'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Edit, Copy, ExternalLink, Trash2, Loader2,
  Eye, EyeOff, MoreVertical, Tag, Calendar, MapPin, Ruler,
  HelpCircle, Info, ChevronDown, ChevronRight, Star,
  DollarSign, Clock, Shield, Sparkles, Package, TrendingUp,
  Check, X, ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PriceDisplay } from '@/components/shared/price-display';
import { productApi } from '@/lib/api/products';
import type {
  ProductDetail,
  ProductVariantData,
  ProductPricingData,
  ProductServicesData,
  ProductSizeData,
} from '@/lib/api/products';
import { useSoftDeleteProduct, useUpdateProductStatus } from '../hooks/use-product-apis';
import { useLocale } from '@/hooks/use-locale';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductTrafficCard } from './components/product-traffic-card';

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] as any },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' as any } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.04 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectivePrice(pricing: ProductPricingData | null): number | null {
  if (!pricing) return null;
  if (pricing.priceOverride) return pricing.priceOverride;
  if (pricing.mode === 'one_time') return pricing.rentalPrice;
  if (pricing.mode === 'per_day') return pricing.pricePerDay;
  if (pricing.mode === 'percentage') return pricing.calculatedPrice;
  return pricing.rentalPrice;
}

function getPricingModeLabel(mode: string): string {
  switch (mode) {
    case 'one_time': return 'One-time Rental';
    case 'per_day': return 'Per Day';
    case 'percentage': return '% of Retail';
    default: return mode;
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'published':
      return {
        label: 'Published',
        className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400',
        dotColor: 'bg-emerald-500',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
      };
    case 'draft':
      return {
        label: 'Draft',
        className: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400',
        dotColor: 'bg-amber-500',
        bgClass: 'bg-amber-50 dark:bg-amber-950/20',
      };
    case 'archived':
      return {
        label: 'Archived',
        className: 'bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-400',
        dotColor: 'bg-slate-400',
        bgClass: 'bg-slate-50 dark:bg-slate-950/20',
      };
    default:
      return { label: status, className: '', dotColor: 'bg-gray-400', bgClass: '' };
  }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Row({ label, value, bold, highlight }: {
  label: React.ReactNode;
  value: React.ReactNode;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 ${
      highlight ? 'px-2.5 py-1.5 -mx-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/20' : ''
    }`}>
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${bold ? 'font-semibold text-foreground' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5 select-none">
      <Icon className="h-3 w-3" />
      {children}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${on ? 'bg-emerald-500' : 'bg-muted-foreground/25'}`} />;
}

// ─── Hero Image Gallery ───────────────────────────────────────────────────────

function ImageGallery({ variants, productName }: { variants: ProductVariantData[]; productName: string }) {
  const [activeVariant, setActiveVariant] = useState(0);
  const [activeImage, setActiveImage] = useState(0);

  if (!variants.length) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl bg-muted/40 border border-dashed flex items-center justify-center">
        <div className="text-center text-muted-foreground/60">
          <ImageIcon className="h-8 w-8 mx-auto mb-1" />
          <p className="text-xs">No images</p>
        </div>
      </div>
    );
  }

  const variant = variants[activeVariant];
  const images = variant?.images || [];
  const currentImage = images[activeImage];

  return (
    <div className="space-y-2.5">
      {/* Main image with crossfade */}
      <div className="aspect-[4/3] w-full rounded-2xl bg-muted border overflow-hidden relative">
        <AnimatePresence mode="wait">
          {currentImage ? (
            <motion.img
              key={currentImage.id}
              src={currentImage.url}
              alt={`${productName} - ${variant.mainColor.name}`}
              className="object-contain w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground/30">
              <Package className="h-10 w-10" />
            </div>
          )}
        </AnimatePresence>

        {/* Featured badge */}
        {currentImage?.isFeatured && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-3 left-3 text-[10px] bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full font-medium flex items-center gap-1 backdrop-blur-sm"
          >
            <Star className="h-2.5 w-2.5" /> Featured
          </motion.span>
        )}

        {/* Counter pill */}
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
            {activeImage + 1} / {images.length}
          </span>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <motion.div className="flex gap-1.5 overflow-x-auto pb-0.5" variants={stagger} initial="hidden" animate="visible">
          {images.map((img, i) => (
            <motion.button
              key={img.id}
              variants={fadeIn}
              onClick={() => setActiveImage(i)}
              className={`h-12 w-12 shrink-0 rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                i === activeImage
                  ? 'border-primary ring-2 ring-primary/15 scale-105'
                  : 'border-transparent opacity-50 hover:opacity-90'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbnailUrl || img.url} alt="" className="object-cover w-full h-full" />
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Variant pills */}
      {variants.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {variants.map((v, i) => (
            <button
              key={v.id}
              onClick={() => { setActiveVariant(i); setActiveImage(0); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                i === activeVariant
                  ? 'border-primary bg-primary/8 text-primary shadow-sm'
                  : 'border-border/50 hover:border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.mainColor.hexCode && (
                <span className="h-2.5 w-2.5 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: v.mainColor.hexCode }} />
              )}
              {v.variantName || v.mainColor.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Pricing ─────────────────────────────────────────────────────────────

function PricingTab({ pricing, services }: { pricing: ProductPricingData | null; services: ProductServicesData | null }) {
  if (!pricing && !services) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No pricing configured.</p>;
  }

  return (
    <motion.div className="space-y-5" variants={stagger} initial="hidden" animate="visible">
      {pricing && (
        <>
          {/* Pricing mode header */}
          <motion.div variants={fadeUp} custom={0} className="flex items-center justify-between">
            <SectionLabel icon={DollarSign}>{getPricingModeLabel(pricing.mode)}</SectionLabel>
            {pricing.priceOverride && (
              <Badge variant="outline" className="text-amber-600 border-amber-300/50 dark:text-amber-400 text-[10px] font-medium">Override Active</Badge>
            )}
          </motion.div>

          {/* Mode-specific rows */}
          <motion.div variants={fadeUp} custom={1} className="space-y-0.5">
            {pricing.mode === 'one_time' && (
              <>
                <Row label="Rental Price" value={<PriceDisplay amount={pricing.rentalPrice || 0} />} bold />
                {pricing.includedDays != null && <Row label="Included Days" value={`${pricing.includedDays} days`} />}
                {pricing.extendedRentalRate != null && <Row label="Extended Rate" value={<><PriceDisplay amount={pricing.extendedRentalRate} />/day</>} />}
              </>
            )}
            {pricing.mode === 'per_day' && (
              <>
                <Row label="Price per Day" value={<PriceDisplay amount={pricing.pricePerDay || 0} />} bold />
                {pricing.minimumDays != null && <Row label="Minimum Days" value={`${pricing.minimumDays} days`} />}
              </>
            )}
            {pricing.mode === 'percentage' && (
              <>
                <Row label="Retail Price" value={<PriceDisplay amount={pricing.retailPrice || 0} />} />
                <Row label="Rental %" value={`${Number(pricing.rentalPercentage)}%`} />
                <Row label="Calculated" value={<PriceDisplay amount={pricing.calculatedPrice || 0} />} bold />
                {pricing.includedDays != null && <Row label="Included Days" value={`${pricing.includedDays} days`} />}
                {pricing.extendedRentalRate != null && <Row label="Extended Rate" value={<><PriceDisplay amount={pricing.extendedRentalRate} />/day</>} />}
              </>
            )}
            {pricing.priceOverride && (
              <Row label="Override Price" value={<PriceDisplay amount={pricing.priceOverride} />} bold highlight />
            )}
          </motion.div>

          {/* Guard rails */}
          {(pricing.minInternalPrice != null || pricing.maxDiscountPrice != null) && (
            <motion.div variants={fadeUp} custom={2}>
              <Separator className="mb-4" />
              <div className="grid grid-cols-2 gap-6">
                {pricing.minInternalPrice != null && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Min Internal</div>
                    <PriceDisplay amount={pricing.minInternalPrice} className="text-sm font-semibold" />
                  </div>
                )}
                {pricing.maxDiscountPrice != null && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Max Discount</div>
                    <PriceDisplay amount={pricing.maxDiscountPrice} className="text-sm font-semibold" />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Late fees */}
          {pricing.lateFeeType && (
            <motion.div variants={fadeUp} custom={3}>
              <Separator className="mb-4" />
              <SectionLabel icon={Clock}>Late Fees</SectionLabel>
              <div className="space-y-0.5">
                <Row label="Type" value={<span className="capitalize">{pricing.lateFeeType}</span>} />
                {pricing.lateFeeType === 'fixed' && pricing.lateFeeAmount != null && (
                  <Row label="Amount/day" value={<PriceDisplay amount={pricing.lateFeeAmount} />} />
                )}
                {pricing.lateFeeType === 'percentage' && pricing.lateFeePercentage != null && (
                  <Row label="Rate/day" value={`${Number(pricing.lateFeePercentage)}%`} />
                )}
                {pricing.maxLateFee != null && <Row label="Cap" value={<PriceDisplay amount={pricing.maxLateFee} />} />}
              </div>
            </motion.div>
          )}

          {/* Shipping */}
          {pricing.shippingMode && (
            <motion.div variants={fadeUp} custom={4}>
              <Separator className="mb-4" />
              <Row
                label="Shipping"
                value={pricing.shippingMode === 'flat'
                  ? <PriceDisplay amount={pricing.shippingFee || 0} />
                  : <span className="capitalize">{pricing.shippingMode}</span>
                }
              />
            </motion.div>
          )}
        </>
      )}

      {/* Services */}
      {services && (
        <motion.div variants={fadeUp} custom={5}>
          <Separator className="mb-4" />
          <SectionLabel icon={Shield}>Services</SectionLabel>
          <div className="space-y-0.5">
            <Row label="Deposit" value={services.depositAmount != null ? <PriceDisplay amount={services.depositAmount} /> : '—'} />
            <Row label="Cleaning" value={services.cleaningFee != null ? <PriceDisplay amount={services.cleaningFee} /> : '—'} />
            {services.backupSizeEnabled && (
              <Row
                label={<span className="flex items-center gap-1.5">Backup Size <Dot on /></span>}
                value={services.backupSizeFee != null ? <PriceDisplay amount={services.backupSizeFee} /> : '—'}
              />
            )}
            {services.tryOnEnabled && (
              <>
                <Row
                  label={<span className="flex items-center gap-1.5">Try-on <Dot on /></span>}
                  value={services.tryOnFee != null ? <PriceDisplay amount={services.tryOnFee} /> : '—'}
                />
                {services.tryOnDurationHours != null && <Row label="Duration" value={`${services.tryOnDurationHours}h`} />}
                {services.tryOnCreditToRental && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                    <Sparkles className="h-3 w-3" /> Try-on credited to rental
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Tab: Sizes ───────────────────────────────────────────────────────────────

function SizesTab({ size }: { size: ProductSizeData | null }) {
  if (!size) return <p className="text-sm text-muted-foreground py-6 text-center">No size info configured.</p>;

  return (
    <motion.div className="space-y-4" variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp} custom={0}>
        <Row label="Size Mode" value={<Badge variant="outline" className="capitalize text-[10px] font-medium">{size.mode.replace('_', ' ')}</Badge>} />
      </motion.div>

      {size.mainDisplaySize && (
        <motion.div variants={fadeUp} custom={1}>
          <Row label="Display Size" value={<span className="font-semibold">{size.mainDisplaySize}</span>} />
        </motion.div>
      )}

      {size.mode === 'standard' && size.availableSizes.length > 0 && (
        <motion.div variants={fadeUp} custom={2}>
          <SectionLabel icon={Ruler}>Available Sizes</SectionLabel>
          <div className="flex gap-1.5 flex-wrap">
            {size.availableSizes.map((s, i) => (
              <motion.span
                key={s}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  s === size.mainDisplaySize
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/50 border-border/50 text-muted-foreground'
                }`}
              >
                {s}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      {size.mode === 'free' && size.freeSizeType && (
        <motion.div variants={fadeUp} custom={2}>
          <Row label="Type" value={<span className="capitalize">{size.freeSizeType.replace('_', ' ')}</span>} />
        </motion.div>
      )}

      {size.mode === 'measurement' && size.measurements.length > 0 && (
        <motion.div variants={fadeUp} custom={2} className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Measurement</th>
                <th className="text-right py-2 px-3 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {size.measurements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2 px-3 text-sm">{m.label}</td>
                  <td className="py-2 px-3 text-right font-medium text-sm">{m.value} {m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {size.mode === 'multi_part' && size.parts.length > 0 && (
        <motion.div variants={fadeUp} custom={2} className="space-y-4">
          {size.parts.map((part) => (
            <div key={part.id} className="rounded-lg border p-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {part.partName}
              </div>
              {part.measurements.length > 0 ? (
                <div className="space-y-0.5">
                  {part.measurements.map((m) => (
                    <Row key={m.id} label={m.label} value={`${m.value} ${m.unit}`} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No measurements</p>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {size.sizeChartUrl && (
        <motion.div variants={fadeUp} custom={3}>
          <a
            href={size.sizeChartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> View Size Chart
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Tab: Variants ────────────────────────────────────────────────────────────

function VariantsTab({ variants }: { variants: ProductVariantData[] }) {
  if (!variants.length) return <p className="text-sm text-muted-foreground py-6 text-center">No variants added.</p>;

  return (
    <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-2" variants={stagger} initial="hidden" animate="visible">
      {variants.map((v, i) => (
        <motion.div
          key={v.id}
          variants={fadeUp}
          custom={i}
          className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-colors duration-200 group"
        >
          <motion.div
            className="h-8 w-8 rounded-full border-2 shadow-sm shrink-0"
            style={{ backgroundColor: v.mainColor.hexCode || '#ccc' }}
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400 }}
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{v.variantName || v.mainColor.name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>{v.images.length} image{v.images.length !== 1 ? 's' : ''}</span>
              {v.identicalColors.length > 0 && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-0.5">
                    {v.identicalColors.slice(0, 3).map((ic) => (
                      <span
                        key={ic.color.id}
                        className="h-2.5 w-2.5 rounded-full border inline-block"
                        style={{ backgroundColor: ic.color.hexCode || '#ccc' }}
                        title={ic.color.name}
                      />
                    ))}
                    {v.identicalColors.length > 3 && (
                      <span className="text-[10px]">+{v.identicalColors.length - 3}</span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
          {v.images[0] && (
            <div className="h-10 w-10 rounded-lg border overflow-hidden shrink-0 group-hover:shadow-sm transition-shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.images[0].thumbnailUrl || v.images[0].url} alt="" className="object-cover w-full h-full" />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Tab: Details ─────────────────────────────────────────────────────────────

function DetailsTab({ headers }: { headers: ProductDetail['detailHeaders'] }) {
  if (!headers.length) return <p className="text-sm text-muted-foreground py-6 text-center">No details added.</p>;

  return (
    <motion.div className="space-y-5" variants={stagger} initial="hidden" animate="visible">
      {headers.map((h, i) => (
        <motion.div key={h.id} variants={fadeUp} custom={i}>
          <SectionLabel icon={Info}>{h.headerName}</SectionLabel>
          {h.entries.length > 0 ? (
            <div className="space-y-0.5">
              {h.entries.map((e) => (
                <Row key={e.id} label={e.key} value={e.value} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No entries</p>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Tab: FAQs ────────────────────────────────────────────────────────────────

function FaqsTab({ faqs }: { faqs: ProductDetail['faqs'] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!faqs.length) return <p className="text-sm text-muted-foreground py-6 text-center">No FAQs added.</p>;

  return (
    <motion.div className="space-y-0.5 divide-y" variants={stagger} initial="hidden" animate="visible">
      {faqs.map((faq, i) => (
        <motion.div key={faq.id} variants={fadeUp} custom={i}>
          <Collapsible open={openIndex === i} onOpenChange={(open) => setOpenIndex(open ? i : null)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-3 text-sm font-medium hover:text-primary transition-colors text-left gap-3 group">
              <span>{faq.question}</span>
              <motion.div
                animate={{ rotate: openIndex === i ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pb-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed"
              >
                {faq.answer}
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { formatPrice, formatDate } = useLocale();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  const softDelete = useSoftDeleteProduct();
  const updateStatus = useUpdateProductStatus();

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    toast.success('Product ID copied');
  };

  const handleStatusToggle = () => {
    if (!product) return;
    const newStatus = product.status === 'published' ? 'draft' : 'published';
    updateStatus.mutate({ id, status: newStatus });
  };

  // ── States ──
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Loader2 className="h-7 w-7 animate-spin text-primary/40" />
        </motion.div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Alert variant="destructive" className="m-6">
          <AlertDescription>
            Failed to load product. {(error as Error)?.message || 'Please try again.'}
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  const statusConfig = getStatusConfig(product.status);
  const effectivePrice = getEffectivePrice(product.pricing);
  const targetProgress = product.targetRentals
    ? Math.min(Math.round((product.totalBookings / product.targetRentals) * 100), 100)
    : null;

  const hasPricing = !!(product.pricing || product.services);
  const hasSizes = !!product.productSize;
  const hasVariants = product.variants.length > 0;
  const hasDetails = product.detailHeaders.length > 0;
  const hasFaqs = product.faqs.length > 0;
  const hasAnyTab = hasPricing || hasSizes || hasVariants || hasDetails || hasFaqs;
  const defaultTab = hasPricing ? 'pricing' : hasSizes ? 'sizes' : hasVariants ? 'variants' : hasDetails ? 'details' : 'faqs';

  return (
    <motion.div
      className="space-y-5 max-w-5xl mx-auto"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Compact, tight top bar
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} custom={0} className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0 h-7 w-7">
            <Link href="/dashboard/products">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight truncate">{product.name}</h1>
              <Badge variant="outline" className={`${statusConfig.className} text-[10px] px-1.5 py-0 font-medium`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor} mr-1`} />
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
              {product.category && (
                <>
                  <Tag className="h-2.5 w-2.5" />
                  <span>{product.category.name}{product.subcategory && <> › {product.subcategory.name}</>}</span>
                  <span className="opacity-30">·</span>
                </>
              )}
              <span className="font-mono">{product.slug}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={product.status === 'published' ? 'outline' : 'default'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={handleStatusToggle}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : product.status === 'published' ? (
              <EyeOff className="h-3 w-3 mr-1" />
            ) : (
              <Eye className="h-3 w-3 mr-1" />
            )}
            {product.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" asChild>
            <Link href={`/dashboard/products/${id}/edit`}>
              <Edit className="h-3 w-3 mr-1" /> Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              <DropdownMenuItem onClick={handleCopyId} className="text-xs">
                <Copy className="h-3 w-3 mr-2" /> Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3 w-3 mr-2" /> Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Image + Quick-glance summary (above the fold)
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} custom={1} className="grid gap-5 lg:grid-cols-5">
        {/* Image — 3 cols */}
        <div className="lg:col-span-3">
          <ImageGallery variants={product.variants} productName={product.name} />
        </div>

        {/* Summary — 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Price + Status */}
          <motion.div
            variants={scaleIn}
            className="rounded-2xl border bg-card p-5 flex-1"
          >
            {/* Effective price — most important UI element */}
            {effectivePrice !== null ? (
              <div className="mb-3">
                <div className="text-3xl font-bold tracking-tight leading-none">
                  <PriceDisplay amount={effectivePrice} />
                </div>
                {product.pricing && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {getPricingModeLabel(product.pricing.mode)}
                    {product.pricing.mode === 'one_time' && product.pricing.includedDays != null && (
                      <> · {product.pricing.includedDays} days included</>
                    )}
                    {product.pricing.mode === 'percentage' && product.pricing.includedDays != null && (
                      <> · {product.pricing.includedDays} days included</>
                    )}
                    {product.pricing.mode === 'per_day' && product.pricing.minimumDays != null && (
                      <> · min {product.pricing.minimumDays} days</>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mb-3">No price set</div>
            )}

            <Separator className="my-3" />

            {/* Status + availability — one compact row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusConfig.dotColor} animate-pulse`} />
                <span className="text-sm font-medium">
                  {product.status === 'published' ? 'Live' : product.status === 'draft' ? 'Draft' : 'Archived'}
                </span>
              </div>
              {product.isAvailable ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="h-3 w-3" /> Available
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <X className="h-3 w-3" /> Unavailable
                </span>
              )}
            </div>

            {product.availableFrom && (
              <p className="text-[11px] text-muted-foreground mt-1.5">Available from {formatDate(product.availableFrom)}</p>
            )}
            {product.unavailableReason && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{product.unavailableReason}</p>
            )}
          </motion.div>

          {/* Traffic Overview Card */}
          <motion.div variants={scaleIn}>
            <ProductTrafficCard productId={id} />
          </motion.div>

          {/* Stats — compact 2-up */}
          <motion.div variants={scaleIn} className="rounded-2xl border bg-card p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Revenue</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                  <PriceDisplay amount={product.totalRevenue} />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Bookings</div>
                <div className="text-xl font-bold leading-tight">{product.totalBookings}</div>
              </div>
            </div>
            {targetProgress !== null && product.targetRentals && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Target: {product.targetRentals}</span>
                  <span className="font-semibold text-foreground">{targetProgress}%</span>
                </div>
                <div className="relative">
                  <Progress value={targetProgress} className="h-1.5" />
                </div>
              </div>
            )}
          </motion.div>

          {/* Description */}
          {product.description && (
            <motion.div variants={scaleIn} className="rounded-2xl border bg-card p-4 flex-1 flex flex-col">
              <div className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap transition-all relative ${!isDescriptionExpanded ? 'line-clamp-5' : ''}`}>
                {product.description}
              </div>
              {product.description.length > 200 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="text-xs text-primary font-medium self-start mt-2 hover:underline"
                >
                  {isDescriptionExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          TABBED CONTENT — All detailed info in one clean container
          ═══════════════════════════════════════════════════════════════════ */}
      {hasAnyTab && (
        <motion.div variants={fadeUp} custom={2} className="rounded-2xl border bg-card overflow-hidden">
          <Tabs defaultValue={defaultTab}>
            <div className="border-b bg-muted/20 px-1">
              <TabsList className="bg-transparent h-10 p-0 w-full justify-start gap-0">
                {hasPricing && (
                  <TabsTrigger
                    value="pricing"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none text-xs h-10 px-4 transition-colors"
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Pricing
                  </TabsTrigger>
                )}
                {hasSizes && (
                  <TabsTrigger
                    value="sizes"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none text-xs h-10 px-4 transition-colors"
                  >
                    <Ruler className="h-3.5 w-3.5 mr-1.5" /> Sizes
                  </TabsTrigger>
                )}
                {hasVariants && (
                  <TabsTrigger
                    value="variants"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none text-xs h-10 px-4 transition-colors"
                  >
                    <Package className="h-3.5 w-3.5 mr-1.5" /> Variants
                    <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1 min-w-[16px] justify-center">{product.variants.length}</Badge>
                  </TabsTrigger>
                )}
                {hasDetails && (
                  <TabsTrigger
                    value="details"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none text-xs h-10 px-4 transition-colors"
                  >
                    <Info className="h-3.5 w-3.5 mr-1.5" /> Details
                  </TabsTrigger>
                )}
                {hasFaqs && (
                  <TabsTrigger
                    value="faqs"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none text-xs h-10 px-4 transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5 mr-1.5" /> FAQs
                    <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1 min-w-[16px] justify-center">{product.faqs.length}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                {hasPricing && (
                  <TabsContent value="pricing" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <PricingTab pricing={product.pricing} services={product.services} />
                  </TabsContent>
                )}
                {hasSizes && (
                  <TabsContent value="sizes" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <SizesTab size={product.productSize} />
                  </TabsContent>
                )}
                {hasVariants && (
                  <TabsContent value="variants" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <VariantsTab variants={product.variants} />
                  </TabsContent>
                )}
                {hasDetails && (
                  <TabsContent value="details" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <DetailsTab headers={product.detailHeaders} />
                  </TabsContent>
                )}
                {hasFaqs && (
                  <TabsContent value="faqs" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <FaqsTab faqs={product.faqs} />
                  </TabsContent>
                )}
              </AnimatePresence>
            </div>
          </Tabs>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER — Compact metadata strip (all tertiary info in one line)
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        custom={3}
        className="rounded-2xl border bg-muted/20 px-4 py-3"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
          {/* Purchase info */}
          {product.purchaseDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 opacity-60" />
              Bought {formatDate(product.purchaseDate)}
            </span>
          )}
          {product.purchasePrice !== null && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 opacity-60" />
              Cost <PriceDisplay amount={product.purchasePrice} className="font-medium text-foreground" />
              {!product.purchasePricePublic && <EyeOff className="h-2.5 w-2.5 opacity-40" />}
            </span>
          )}
          {product.itemCountry && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 opacity-60" />
              {product.itemCountry}
              {!product.itemCountryPublic && <EyeOff className="h-2.5 w-2.5 opacity-40" />}
            </span>
          )}

          {/* Events inline */}
          {product.events.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3 opacity-60" />
              {product.events.map((pe) => (
                <Badge key={pe.event.id} variant="secondary" className="text-[9px] px-1.5 py-0 font-normal h-4">
                  {pe.event.name}
                </Badge>
              ))}
            </span>
          )}

          <div className="flex-1" />

          {/* Timestamps + ID */}
          <span>Created {formatDate(product.createdAt)}</span>
          <span>Updated {formatDate(product.updatedAt)}</span>
          <button
            onClick={handleCopyId}
            className="font-mono hover:text-primary transition-colors cursor-pointer flex items-center gap-0.5"
          >
            {id.slice(0, 8)}… <Copy className="h-2.5 w-2.5" />
          </button>
        </div>
      </motion.div>

      {/* ── Trash confirm ── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Move to trash?"
        description="This product will be moved to the trash bin. You can restore it later. This will fail if the product has active or future bookings."
        confirmLabel={softDelete.isPending ? 'Deleting...' : 'Move to Trash'}
        variant="destructive"
        loading={softDelete.isPending}
        onConfirm={() => {
          softDelete.mutate(id, {
            onSuccess: () => {
              setShowDeleteConfirm(false);
              router.push('/dashboard/products');
            },
          });
        }}
      />
    </motion.div>
  );
}
