'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Edit, Copy, Trash2, Loader2,
  Eye, EyeOff, MoreVertical, Tag, MapPin, Ruler, Undo2,
  HelpCircle, Info, ChevronRight, Star,
  DollarSign, Shield, Package,
  Check, X, ImageIcon, Settings, Grid3X3, Boxes, AlertCircle, History
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { FieldTip } from '@/components/shared/field-tip';
import { PageHeader } from '@/components/shared/page-header';
import { PriceDisplay } from '@/components/shared/price-display';
import { productApi } from '@/lib/api/products';
import type {
  ProductDetail,
  ProductVariantData,
  PricingProfileData,
} from '@/lib/api/products';
import {
  usePublishProduct,
  useSoftDeleteProduct,
  useUpdateProductStatus,
} from '../hooks/use-product-apis';
import { useLocale } from '@/hooks/use-locale';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ProductTrafficCard } from './components/product-traffic-card';
import {
  getProductReadinessFixHref,
  getProductReadinessGuidance,
} from '../components/product-readiness-guidance';

const REQUIRED_PUBLISH_SECTIONS = ['BASICS', 'SKUS', 'CONTENT', 'PRICING'] as const;

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.04 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectivePrice(pricing: PricingProfileData | null): number | null {
  if (!pricing) return null;
  const config = pricing.ratePlanConfig;
  if (pricing.ratePlanType === 'PER_DAY') return Number(config.unitPriceMinor ?? 0);
  if (pricing.ratePlanType === 'FLAT_PERIOD') return Number(config.flatPriceMinor ?? 0);
  if (pricing.ratePlanType === 'TIERED_DAILY') {
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    return Number((tiers[0] as Record<string, unknown> | undefined)?.pricePerDayMinor ?? 0);
  }
  if (pricing.ratePlanType === 'WEEKLY_MONTHLY') {
    return Number(config.dailyPriceMinor ?? config.weeklyPriceMinor ?? config.monthlyPriceMinor ?? 0);
  }
  return Number(config.minPriceMinor ?? 0);
}

function getPricingModeLabel(mode: string): string {
  switch (mode) {
    case 'FLAT_PERIOD': return 'Rental Package';
    case 'PER_DAY': return 'Per Day';
    case 'TIERED_DAILY': return 'Tiered Daily';
    case 'WEEKLY_MONTHLY': return 'Daily / Weekly / Monthly';
    case 'PERCENT_RETAIL': return '% of Retail';
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
      };
    case 'draft':
      return {
        label: 'Draft',
        className: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400',
        dotColor: 'bg-amber-500',
      };
    case 'archived':
      return {
        label: 'Archived',
        className: 'bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-400',
        dotColor: 'bg-slate-400',
      };
    default:
      return { label: status, className: '', dotColor: 'bg-gray-400' };
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

function getSelectorType(definition: unknown): string {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return 'grid';
  const ui = (definition as Record<string, unknown>).ui;
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) return 'grid';
  const selectorType = (ui as Record<string, unknown>).selectorType;
  return typeof selectorType === 'string' ? selectorType : 'grid';
}

// ─── Hero Image Gallery ───────────────────────────────────────────────────────

function ImageGallery({ variants, productName }: { variants: ProductVariantData[]; productName: string }) {
  const [activeVariant, setActiveVariant] = useState(0);
  const [activeImage, setActiveImage] = useState(0);

  if (!variants.length) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed bg-muted/30">
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
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted/30">
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
              type="button"
              variants={fadeIn}
              onClick={() => setActiveImage(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-pressed={i === activeImage}
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
              type="button"
              onClick={() => { setActiveVariant(i); setActiveImage(0); }}
              aria-pressed={i === activeVariant}
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

function PricingTab({ pricing }: { pricing: PricingProfileData | null }) {
  if (!pricing) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No pricing configured.</p>;
  }

  const configEntries = Object.entries(pricing.ratePlanConfig).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
  );

  return (
    <motion.div className="space-y-5" variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp} custom={0}>
        <SectionLabel icon={DollarSign}>{getPricingModeLabel(pricing.ratePlanType)}</SectionLabel>
        <div className="space-y-0.5">
          {configEntries.map(([key, value]) => (
            <Row key={key} label={key.replace(/([A-Z])/g, ' $1')} value={String(value)} />
          ))}
        </div>
      </motion.div>
      {pricing.components.length > 0 && (
        <motion.div variants={fadeUp} custom={1}>
          <Separator className="mb-4" />
          <SectionLabel icon={Shield}>Fees, deposits & add-ons</SectionLabel>
          <div className="space-y-0.5">
            {pricing.components.map((component) => (
              <Row
                key={component.id}
                label={String(component.config.label ?? component.type)}
                value={<PriceDisplay amount={Number((component.config.pricing as Record<string, unknown> | undefined)?.amountMinor ?? 0)} />}
              />
            ))}
          </div>
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
            <div className="font-medium text-sm flex items-center gap-2 truncate">
              {v.variantName || v.mainColor.name}
              {v.sizes.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider font-semibold">
                  {v.sizes.map((size) => size.sizeInstance.displayLabel).join(', ')}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
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

// ─── Tab: Sizes ───────────────────────────────────────────────────────────────

function SizesTab({ sizing, productType }: { sizing: ProductDetail['sizing'], productType: ProductDetail['productType'] }) {
  if (!sizing) return <p className="text-sm text-muted-foreground py-6 text-center">No size schema configured.</p>;

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="visible">
      {/* Schema Header */}
      <motion.div variants={fadeUp} custom={0}>
        <SectionLabel icon={Settings}>Configuration</SectionLabel>
        <div className="space-y-1">
          <Row label="Product Type" value={productType?.name || 'Unassigned'} />
          <Row label="Active Schema" value={
            <span className="flex items-center gap-2">
              {sizing.schema.name}
              <Badge variant="outline" className="text-[9px] px-1 uppercase tracking-widest">{sizing.schema.code}</Badge>
            </span>
          } bold />
          <Row label="Selector Mode" value={<span className="capitalize">{getSelectorType(sizing.schema.definition)}</span>} />
        </div>
      </motion.div>

      <Separator />

      {/* Size Instances Map */}
      <motion.div variants={fadeUp} custom={1}>
        <SectionLabel icon={Ruler}>Allowed Sizes ({sizing.instances.length})</SectionLabel>
        {sizing.instances.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {sizing.instances.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-center rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/40"
                title={`Sort Order: ${inst.sortOrder}`}
              >
                {inst.displayLabel}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">No sizes configured in this schema.</p>
        )}
      </motion.div>

      {/* Size Charts */}
      {sizing.sizeCharts && sizing.sizeCharts.length > 0 && (
        <motion.div variants={fadeUp} custom={2}>
          <Separator className="mb-4" />
          <SectionLabel icon={Grid3X3}>Size Guides ({sizing.sizeCharts.length})</SectionLabel>
          <div className="mt-3 space-y-4">
            {sizing.sizeCharts.map(chart => (
              <div key={chart.id} className="overflow-hidden rounded-xl border border-border">
                <div className="bg-muted px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border flex items-center justify-between">
                  {chart.title}
                </div>
                {chart.rows?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">Size</th>
                          {Object.keys(chart.rows[0]?.measurements || {}).map((key) => (
                            <th key={key} className="px-3 py-2.5 text-left font-semibold text-muted-foreground capitalize whitespace-nowrap">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.rows.map(row => (
                          <tr key={row.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-foreground border-r bg-muted/10">{row.sizeLabel}</td>
                            {Object.values(row.measurements || {}).map((val, idx) => (
                              <td key={idx} className="px-3 py-2.5 text-foreground/80">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-xs text-muted-foreground text-center">No rows configured.</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
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
  const { formatDate } = useLocale();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const { data: product, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  const softDelete = useSoftDeleteProduct();
  const updateStatus = useUpdateProductStatus();
  const publishProduct = usePublishProduct();

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    toast.success('Product ID copied');
  };

  const handleStatusToggle = () => {
    if (!product) return;
    if (product.status === 'published' || product.status === 'archived') {
      updateStatus.mutate({ id, status: 'draft' });
      return;
    }
    if (product.onboarding) {
      publishProduct.mutate({ id, revision: product.onboarding.revision });
    }
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
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Failed to load product. {(error as Error)?.message || 'Please try again.'}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  const statusConfig = getStatusConfig(product.status);
  const needsSetup = Boolean(
    product.onboarding && !product.onboarding.completedSections.includes('REVIEW'),
  );
  const editHref = needsSetup && product.status === 'draft'
    ? `/dashboard/products/new?productId=${id}`
    : `/dashboard/products/${id}/edit`;
  const canPublish = Boolean(
    product.status === 'published'
      || product.status === 'archived'
      || (product.status === 'draft'
        && product.readiness.ready
        && product.onboarding
        && REQUIRED_PUBLISH_SECTIONS.every((section) =>
          product.onboarding?.completedSections.includes(section),
        )),
  );
  const lifecycleMutationPending = updateStatus.isPending || publishProduct.isPending;
  const effectivePrice = getEffectivePrice(product.pricing);
  const skuCount = product.variants.reduce((total, variant) => total + variant.sizes.length, 0);
  const activePhysicalItemCount = product.variants.reduce(
    (total, variant) => total + variant.sizes.reduce(
      (variantTotal, size) => variantTotal + (size._count?.stockUnits ?? 0),
      0,
    ),
    0,
  );

  const hasPricing = !!product.pricing;
  const hasSizes = !!product.sizing?.schema;
  const hasVariants = product.variants.length > 0;
  const hasDetails = product.detailHeaders.length > 0;
  const hasFaqs = product.faqs.length > 0;
  const hasAnyTab = hasPricing || hasSizes || hasVariants || hasDetails || hasFaqs;
  const defaultTab = hasPricing ? 'pricing' : hasSizes ? 'sizes' : hasVariants ? 'variants' : hasDetails ? 'details' : 'faqs';

  return (
    <motion.div
      className="space-y-6 pb-10"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <motion.div variants={fadeUp} custom={0}>
        <PageHeader
          title={product.name}
          description={[product.category?.name, product.subcategory?.name, product.productType?.name]
            .filter(Boolean)
            .join(' · ')}
          className="mb-0"
          breadcrumbs={[
            { label: 'Products', href: '/dashboard/products' },
            { label: product.name },
          ]}
          actions={(
            <>
              <Button
                variant={product.status === 'draft' ? 'default' : 'outline'}
                onClick={handleStatusToggle}
                disabled={lifecycleMutationPending || !canPublish}
                title={!canPublish ? 'Complete the catalog setup before publishing' : undefined}
              >
                {lifecycleMutationPending ? <Loader2 className="animate-spin" data-icon="inline-start" />
                  : product.status === 'published' ? <EyeOff data-icon="inline-start" />
                    : product.status === 'archived' ? <Undo2 data-icon="inline-start" />
                      : <Eye data-icon="inline-start" />}
                {product.status === 'published' ? 'Unpublish' : product.status === 'archived' ? 'Restore to draft' : 'Publish'}
              </Button>
              <Button variant="outline" asChild>
                <Link href={editHref}><Edit data-icon="inline-start" />{needsSetup && product.status === 'draft' ? 'Continue setup' : 'Edit product'}</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More product actions"><MoreVertical /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild><Link href={`/dashboard/products/${id}/inventory`}><Package />Manage physical items</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href={`/dashboard/products/${id}/composition`}><Boxes />Bundle composition</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href={`/dashboard/settings/activity-log?entityType=product&entityId=${id}`}><History />Product history</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyId}><Copy />Copy product ID</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}><Trash2 />Move to trash</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className={statusConfig.className}>
            <span className={`mr-1.5 size-2 rounded-full ${statusConfig.dotColor}`} />{statusConfig.label}
          </Badge>
          <Badge variant={product.readiness.ready ? 'secondary' : 'outline'}>
            {product.readiness.ready ? <Check data-icon="inline-start" /> : <AlertCircle data-icon="inline-start" />}
            {product.readiness.ready ? 'Catalog ready' : `${product.readiness.blockers.length} setup blocker${product.readiness.blockers.length === 1 ? '' : 's'}`}
          </Badge>
          <span className="font-mono text-xs">{product.slug}</span>
        </div>
      </motion.div>

      {!product.readiness.ready && (
        <motion.div variants={fadeUp} custom={1}>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium text-foreground">A few catalog details still need attention</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {product.status === 'published'
                  ? 'Your product and physical items are saved, and the listing remains published. Resolve these specific catalog requirements before its next publication change.'
                  : 'Your product and physical items are saved. Complete these specific steps before the listing can be published.'}
              </p>
              <ol className="mt-4 space-y-3">
                {product.readiness.blockers.map((blocker, index) => {
                  const guidance = getProductReadinessGuidance(blocker);
                  return (
                    <li key={`${blocker.code}-${blocker.entityId ?? blocker.field ?? index}`} className="flex flex-col gap-2 rounded-md border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{index + 1}</span>
                        <div>
                          <p className="font-medium text-foreground">{guidance.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{guidance.description}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0" asChild>
                        <Link href={getProductReadinessFixHref({ productId: id, blocker, needsSetup })}>
                          Fix this
                          <ChevronRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div variants={fadeUp} custom={1} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              Rental price
              <FieldTip tip="The headline rental amount from the active pricing policy. Deposits, delivery, and optional services are shown separately in Pricing." />
            </CardDescription>
            <CardTitle className="text-2xl">
              {effectivePrice === null ? 'Not configured' : <PriceDisplay amount={effectivePrice} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {product.pricing ? getPricingModeLabel(product.pricing.ratePlanType) : 'Required before publication'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              Active physical items
              <FieldTip tip="Individually tracked rental pieces currently active across every SKU for this product." />
            </CardDescription>
            <CardTitle className="text-2xl">{activePhysicalItemCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link href={`/dashboard/products/${id}/inventory`}>Open inventory</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              Rentable SKUs
              <FieldTip tip="The valid variant-and-size choices customers can rent. Every physical item belongs to one SKU." />
            </CardDescription>
            <CardTitle className="text-2xl">{skuCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              Bookings
              <FieldTip tip="All booking records associated with this product, including retained historical rentals." />
            </CardDescription>
            <CardTitle className="text-2xl">{product.totalBookings}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Lifetime rental activity</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              Revenue
              <FieldTip tip="Recorded lifetime revenue attributed to bookings for this product in the store currency." />
            </CardDescription>
            <CardTitle className="text-2xl"><PriceDisplay amount={product.totalRevenue} /></CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Lifetime recorded revenue</CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} custom={2} className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Product and variant images</CardTitle>
            <CardDescription>
              Review the featured image and full media order customers see for each color or style.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageGallery variants={product.variants} productName={product.name} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catalog and rental state</CardTitle>
              <CardDescription>Publication and physical-item availability are separate controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row
                label={<span className="flex items-center">Publication <FieldTip tip="Published products can appear in the storefront. Draft and archived products remain internal." /></span>}
                value={statusConfig.label}
                bold
              />
              <Row
                label={<span className="flex items-center">Rental availability <FieldTip tip="Availability depends on active physical items, operational state, reservations, and availability rules—not publication alone." /></span>}
                value={product.isAvailable
                  ? <span className="flex items-center gap-1 text-emerald-600"><Check className="size-3.5" />Available</span>
                  : <span className="flex items-center gap-1 text-muted-foreground"><X className="size-3.5" />Unavailable</span>}
                bold
              />
              <Row label="Product type" value={product.productType?.name || 'Not assigned'} />
              <Row label="Size system" value={product.sizing?.schema.name || 'Not assigned'} />
              <Row label="Item condition visibility" value={product.storefrontItemMode === 'CONDITION_SUMMARY' ? 'Customer summary' : 'Internal only'} />
              {product.availableFrom ? <Row label="Available from" value={formatDate(product.availableFrom)} /> : null}
              {product.unavailableReason ? <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">{product.unavailableReason}</div> : null}
            </CardContent>
          </Card>

          <motion.div variants={fadeUp}>
            <ProductTrafficCard productId={id} />
          </motion.div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operational workspaces</CardTitle>
              <CardDescription>Manage the records connected to this catalog product.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button variant="outline" asChild><Link href={`/dashboard/products/${id}/inventory`}><Package data-icon="inline-start" />Physical items</Link></Button>
              <Button variant="outline" asChild><Link href={`/dashboard/products/${id}/composition`}><Boxes data-icon="inline-start" />Bundle rules</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer-facing description</CardTitle>
              <CardDescription>The main product story and rental context shown on the storefront.</CardDescription>
            </CardHeader>
            <CardContent>
              {product.description ? (
                <>
                  <div className={`whitespace-pre-wrap text-sm leading-6 text-muted-foreground ${!isDescriptionExpanded ? 'line-clamp-5' : ''}`}>{product.description}</div>
                  {product.description.length > 200 ? <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>{isDescriptionExpanded ? 'Show less' : 'Show full description'}</Button> : null}
                </>
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  <p>No storefront description has been added.</p>
                  <Button variant="outline" size="sm" asChild><Link href={editHref}>Add description</Link></Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {hasAnyTab && (
        <motion.div variants={fadeUp} custom={3} className="overflow-hidden rounded-lg border bg-card">
          <div className="px-6 py-5">
            <h2 className="font-semibold">Catalog configuration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pricing, sizing, variants, structured details, and customer questions.
            </p>
          </div>
          <Tabs defaultValue={defaultTab}>
            <div className="overflow-x-auto border-y bg-muted/20 px-2">
              <TabsList className="h-11 w-max justify-start gap-0 bg-transparent p-0">
                {hasPricing && (
                  <TabsTrigger
                    value="pricing"
                    className="h-11 rounded-none px-4 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Pricing
                  </TabsTrigger>
                )}
                {hasSizes && (
                  <TabsTrigger
                    value="sizes"
                    className="h-11 rounded-none px-4 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Ruler className="h-3.5 w-3.5 mr-1.5" /> Sizes
                  </TabsTrigger>
                )}
                {hasVariants && (
                  <TabsTrigger
                    value="variants"
                    className="h-11 rounded-none px-4 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Package className="h-3.5 w-3.5 mr-1.5" /> Variants
                    <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1 min-w-[16px] justify-center">{product.variants.length}</Badge>
                  </TabsTrigger>
                )}
                {hasDetails && (
                  <TabsTrigger
                    value="details"
                    className="h-11 rounded-none px-4 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Info className="h-3.5 w-3.5 mr-1.5" /> Details
                  </TabsTrigger>
                )}
                {hasFaqs && (
                  <TabsTrigger
                    value="faqs"
                    className="h-11 rounded-none px-4 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <HelpCircle className="h-3.5 w-3.5 mr-1.5" /> FAQs
                    <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1 min-w-[16px] justify-center">{product.faqs.length}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {hasPricing && (
                  <TabsContent value="pricing" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <PricingTab pricing={product.pricing} />
                  </TabsContent>
                )}
                {hasSizes && (
                  <TabsContent value="sizes" className="m-0 mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    <SizesTab sizing={product.sizing} productType={product.productType} />
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

      <motion.div
        variants={fadeUp}
        custom={4}
        className="rounded-lg border bg-card p-6"
      >
        <div className="mb-4">
          <h2 className="font-semibold">Product record</h2>
          <p className="mt-1 text-sm text-muted-foreground">Internal provenance, merchandising tags, and record history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {/* Catalog provenance */}
          {product.referenceRetailValue !== null && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 opacity-60" />
              Reference retail value <PriceDisplay amount={product.referenceRetailValue} className="font-medium text-foreground" />
              {!product.referenceRetailValuePublic && <EyeOff className="h-2.5 w-2.5 opacity-40" />}
            </span>
          )}
          {product.countryOfOrigin && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 opacity-60" />
              Origin: {product.countryOfOrigin}
              {!product.countryOfOriginPublic && <EyeOff className="h-2.5 w-2.5 opacity-40" />}
            </span>
          )}

          {/* Events inline */}
          {product.events.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3 opacity-60" />
              {product.events.map((pe) => (
                <Badge key={pe.event.id} variant="secondary" className="font-normal">
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
