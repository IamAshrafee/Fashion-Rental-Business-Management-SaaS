'use client';

import { useFormContext } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Edit2,
  AlertTriangle,
  Info,
  Image as ImageIcon,
  DollarSign,
  Shield,
  Ruler,
  FileText,
} from 'lucide-react';
import { useCategories, useEvents, useColors } from '../../../hooks/use-product-apis';
import { Button } from '@/components/ui/button';

interface ReviewStepProps {
  onGoToStep?: (step: number) => void;
}

/* ─── Section Card ─────────────────────────────────────────────────────── */
function ReviewCard({
  title,
  icon: Icon,
  step,
  onGoToStep,
  children,
  warnings = [],
}: {
  title: string;
  icon: React.ElementType;
  step: number;
  onGoToStep?: (step: number) => void;
  children: React.ReactNode;
  warnings?: string[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {warnings.length > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-[10px] px-1.5">
              {warnings.length} tip{warnings.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {onGoToStep && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 min-h-[36px]"
            onClick={() => onGoToStep(step)}
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-2 text-sm">
        {children}
        {warnings.length > 0 && (
          <div className="pt-2 border-t mt-3 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Row ──────────────────────────────────────────────────────────────── */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-right max-w-[60%]">{value}</span>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */
export function ReviewStep({ onGoToStep }: ReviewStepProps) {
  const { watch, formState } = useFormContext<ProductFormValues>();
  const data = watch();

  const { data: categories } = useCategories();
  const { data: events } = useEvents();
  const { data: colors } = useColors();

  // Resolve names
  const categoryName = categories?.find((c) => c.id === data.categoryId)?.name || 'Not set';
  const currentCategory = categories?.find((c) => c.id === data.categoryId);
  const subcategoryName = currentCategory?.subcategories?.find((s: any) => s.id === data.subcategoryId)?.name;
  const selectedEvents = events?.filter((e) => data.events?.includes(e.id)).map((e) => e.name) || [];
  const totalImages = data.variants?.reduce((acc, v) => acc + (v.images?.length || 0), 0) || 0;

  // Pricing label
  const pricingLabel = (() => {
    if (!data.ratePlanType || !data.ratePlanConfig) return 'Not configured';
    const config = data.ratePlanConfig as any;
    switch (data.ratePlanType) {
      case 'FLAT_PERIOD': return `৳${config.flatPriceMinor || 0} for ${config.includedDays || '?'} days`;
      case 'PER_DAY': return `৳${config.unitPriceMinor || 0}/day (min ${config.minDays || 1}d)`;
      case 'TIERED_DAILY': return `Tiered (${config.tiers?.length || 0} tiers)`;
      case 'WEEKLY_MONTHLY': return `৳${config.dailyPriceMinor || 0}/d | ৳${config.weeklyPriceMinor || 0}/w`;
      case 'PERCENT_RETAIL': return `${config.percent || 0}% of retail`;
    }
    return data.ratePlanType;
  })();

  // Warnings (recommendations, not errors)
  const basicWarnings: string[] = [];
  if (!data.description) basicWarnings.push('No description provided — customers may skip this product.');
  if (selectedEvents.length === 0) basicWarnings.push('No events selected — product won\'t appear in event-based filters.');
  
  const variantWarnings: string[] = [];
  data.variants?.forEach((v, i) => {
    if (!v.images || v.images.length === 0) variantWarnings.push(`Variant "${v.name || i + 1}" has no images.`);
    if (v.images && v.images.length < 3) variantWarnings.push(`Variant "${v.name || i + 1}" has fewer than 3 images — more photos convert better.`);
  });

  const pricingWarnings: string[] = [];
  const hasDeposit = (data.pricingComponents || []).some(c => c.type === 'DEPOSIT');
  if (!hasDeposit) pricingWarnings.push('No security deposit — consider adding one to protect against damage.');
  if (!data.lateFeeEnabled) pricingWarnings.push('No late fee configured — customers may delay returns.');

  const sizeWarnings: string[] = [];
  if (!data.productTypeId) {
    sizeWarnings.push('No Product Type selected — product sizing will not be configured correctly.');
  }
  if (!data.faqs || data.faqs.length === 0) sizeWarnings.push('No FAQs added — common questions reduce customer support load.');

  const hasErrors = Object.keys(formState.errors).length > 0;
  const totalWarnings = basicWarnings.length + variantWarnings.length + pricingWarnings.length + sizeWarnings.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & Publish</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your product before publishing. Click "Edit" on any section to make changes.
        </p>
      </div>

      {/* Status Banner */}
      {hasErrors ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Form has errors</AlertTitle>
          <AlertDescription>
            Fix all validation errors before publishing. Check highlighted steps in the navigator.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="default" className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <span>Ready to complete</span>
            <Badge variant={data.status === 'published' ? 'default' : 'secondary'} className="uppercase text-[10px]">
              {data.status === 'published' ? 'Will be Live' : 'Saved as Draft'}
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400 mt-2">
            All required fields are filled.
            {data.status === 'draft' ? ' This product will remain invisible to customers until you publish it.' : ' This product will go live on your storefront instantly.'}
            {totalWarnings > 0 && ` ${totalWarnings} optional improvement${totalWarnings > 1 ? 's' : ''} suggested below.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Cost Breakdown Card */}
      {data.ratePlanType && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-5 pb-4">
            <h3 className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-3">
              Pricing Configuration
            </h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Rate Plan" value={pricingLabel} />
              {data.pricingComponents?.map((comp, idx) => (
                <Row key={idx} label={comp.type.replace(/_/g, ' ')} value={`৳${comp.config?.amountMinor || 0}${comp.type === 'DEPOSIT' ? ' (refundable)' : ''}`} />
              ))}
              {data.lateFeeEnabled && (
                <Row label="Late Fee" value={`৳${data.lateFeeAmountMinor || 0}/day (after ${data.lateFeeGraceHours}h)`} />
              )}
              {data.shippingMode === 'flat' && (data.flatShippingFee ?? 0) > 0 && (
                <Row label="Shipping" value={`৳${data.flatShippingFee?.toLocaleString()}`} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Product Info ──────────────────────────────────── */}
        <ReviewCard title="Product Info" icon={Info} step={0} onGoToStep={onGoToStep} warnings={basicWarnings}>
          <Row label="Name" value={data.name || 'Not set'} />
          <Row label="Category" value={categoryName} />
          {subcategoryName && <Row label="Subcategory" value={subcategoryName} />}
          <Row
            label="Status"
            value={
              <Badge
                variant={data.status === 'published' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {data.status}
              </Badge>
            }
          />
          {selectedEvents.length > 0 && (
            <div className="flex justify-between items-start py-0.5">
              <span className="font-medium text-muted-foreground">Events</span>
              <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                {selectedEvents.map((name) => (
                  <Badge key={name} variant="outline" className="text-[10px]">{name}</Badge>
                ))}
              </div>
            </div>
          )}
          {data.targetRentals && <Row label="Target Rentals" value={data.targetRentals.toString()} />}
          {data.purchasePrice && <Row label="Purchase Price" value={`৳${data.purchasePrice}`} />}
        </ReviewCard>

        {/* ── Variants & Media ─────────────────────────────── */}
        <ReviewCard title="Variants & Media" icon={ImageIcon} step={2} onGoToStep={onGoToStep} warnings={variantWarnings}>
          <Row label="Variants" value={String(data.variants?.length || 0)} />
          <Row label="Total Images" value={String(totalImages)} />
          {data.variants?.map((v, idx) => {
            const mainColor = colors?.find((c) => c.id === v.mainColorId);
            const imageCount = v.images?.length || 0;
            const firstImageUrl = v.images?.[0]?.url;
            return (
              <div key={idx} className="flex items-center justify-between py-1.5 border-t first:border-t-0">
                <div className="flex items-center gap-2">
                  {/* Thumbnail */}
                  {firstImageUrl ? (
                    <div className="h-8 w-8 rounded overflow-hidden border bg-muted shrink-0">
                      <img src={firstImageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : mainColor?.hexCode ? (
                    <div className="h-8 w-8 rounded border shrink-0" style={{ backgroundColor: mainColor.hexCode }} />
                  ) : (
                    <div className="h-8 w-8 rounded border bg-muted shrink-0 flex items-center justify-center">
                      <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-muted-foreground text-sm">{v.name || mainColor?.name || `Variant ${idx + 1}`}</span>
                </div>
                <Badge variant={imageCount > 0 ? 'secondary' : 'destructive'} className="text-[10px]">
                  {imageCount} img{imageCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            );
          })}
        </ReviewCard>

        {/* ── Pricing & Fees ───────────────────────────────── */}
        <ReviewCard title="Pricing & Fees" icon={DollarSign} step={3} onGoToStep={onGoToStep} warnings={pricingWarnings}>
          <Row
            label="Rate Plan Type"
            value={
              <Badge variant="outline" className="capitalize">
                {data.ratePlanType?.replace('_', ' ') || 'Not Set'}
              </Badge>
            }
          />
          <Row label="Base Price" value={pricingLabel} />
          {data.shippingMode && (
            <Row
              label="Shipping"
              value={
                data.shippingMode === 'flat'
                  ? `Flat ৳${data.flatShippingFee || 0}`
                  : data.shippingMode === 'area_based'
                  ? 'Area based'
                  : 'Free'
              }
            />
          )}
          
          <div className="border-t mt-2 pt-2">
            {data.pricingComponents?.filter(c => c.type === 'DEPOSIT').map((c, i) => (
              <Row key={i} label="Security Deposit" value={`৳${c.config?.amountMinor || 0}`} />
            ))}
            {data.pricingComponents?.filter(c => c.type !== 'DEPOSIT').map((c, i) => (
              <Row key={i} label={c.type.replace(/_/g, ' ')} value={`৳${c.config?.amountMinor || 0}`} />
            ))}
          </div>
        </ReviewCard>

        {/* ── Size & Details ───────────────────────────────── */}
        <ReviewCard title="Size & Details" icon={Ruler} step={1} onGoToStep={onGoToStep} warnings={sizeWarnings}>
          <Row
            label="Product Type"
            value={
              <Badge variant="outline" className="capitalize">
                {data.productTypeId ? 'Assigned' : 'Not set'}
              </Badge>
            }
          />
          {data.sizeSchemaOverrideId && <Row label="Custom Size Schema" value={<Badge variant="default" className="text-[10px]">Overridden</Badge>} />}
          
          {/* Details & FAQ summary */}
          {((data.details && data.details.length > 0) || (data.faqs && data.faqs.length > 0)) && (
            <div className="border-t mt-2 pt-2">
              <span className="font-medium text-muted-foreground text-xs flex items-center gap-1 mb-1">
                <FileText className="h-3 w-3" /> Content
              </span>
              {data.details && data.details.length > 0 && (
                <Row label="Detail Sections" value={String(data.details.length)} />
              )}
              {data.faqs && data.faqs.length > 0 && (
                <Row label="FAQs" value={String(data.faqs.length)} />
              )}
            </div>
          )}
        </ReviewCard>
      </div>
    </div>
  );
}
