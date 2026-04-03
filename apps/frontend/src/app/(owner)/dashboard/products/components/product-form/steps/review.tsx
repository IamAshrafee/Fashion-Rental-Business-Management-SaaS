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
    switch (data.pricingMode) {
      case 'one_time':
        return `৳${data.rentalPrice || 0} for ${data.includedDays || '?'} days`;
      case 'per_day':
        return `৳${data.pricePerDay || 0}/day (min ${data.minimumDays || 1} days)`;
      case 'percentage': {
        const calc = Math.round((data.retailPrice || 0) * (data.rentalPercentage || 0) / 100);
        return `${data.rentalPercentage || 0}% of ৳${data.retailPrice || 0} = ৳${calc}`;
      }
      default:
        return 'Not configured';
    }
  })();

  // Cost breakdown
  const rentalAmount = (() => {
    if (data.pricingMode === 'one_time') return data.rentalPrice || 0;
    if (data.pricingMode === 'per_day') return (data.pricePerDay || 0) * (data.minimumDays || 1);
    if (data.pricingMode === 'percentage') return Math.round((data.retailPrice || 0) * (data.rentalPercentage || 0) / 100);
    return 0;
  })();
  const totalCustomerPays = rentalAmount + (data.securityDeposit || 0) + (data.cleaningFee || 0) + (data.shippingMode === 'flat' ? (data.flatShippingFee || 0) : 0);

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
  if (!data.securityDeposit) pricingWarnings.push('No security deposit — consider adding one to protect against damage.');
  if (!data.lateFeePerDay && !data.lateFeePercentage) pricingWarnings.push('No late fee configured — customers may delay returns.');

  const sizeWarnings: string[] = [];
  if (data.sizeMode === 'standard' && (!data.availableSizes || data.availableSizes.length === 0)) {
    sizeWarnings.push('No sizes selected in standard mode.');
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
          <AlertTitle className="text-emerald-800 dark:text-emerald-300">Ready to publish</AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            All required fields are filled.
            {totalWarnings > 0 && ` ${totalWarnings} optional improvement${totalWarnings > 1 ? 's' : ''} suggested below.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Cost Breakdown Card */}
      {rentalAmount > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-5 pb-4">
            <h3 className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-3">
              Customer Cost Breakdown
            </h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Rental" value={`৳${rentalAmount.toLocaleString()}`} />
              {(data.securityDeposit ?? 0) > 0 && (
                <Row label="Security Deposit (refundable)" value={`৳${data.securityDeposit?.toLocaleString()}`} />
              )}
              {(data.cleaningFee ?? 0) > 0 && (
                <Row label="Cleaning Fee" value={`৳${data.cleaningFee?.toLocaleString()}`} />
              )}
              {data.shippingMode === 'flat' && (data.flatShippingFee ?? 0) > 0 && (
                <Row label="Shipping" value={`৳${data.flatShippingFee?.toLocaleString()}`} />
              )}
              <div className="border-t pt-1.5 mt-1.5">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total at Checkout</span>
                  <span className="text-lg text-primary">৳{totalCustomerPays.toLocaleString()}</span>
                </div>
              </div>
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
        <ReviewCard title="Variants & Media" icon={ImageIcon} step={1} onGoToStep={onGoToStep} warnings={variantWarnings}>
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
                  ) : mainColor?.hex ? (
                    <div className="h-8 w-8 rounded border shrink-0" style={{ backgroundColor: mainColor.hex }} />
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
        <ReviewCard title="Pricing & Fees" icon={DollarSign} step={2} onGoToStep={onGoToStep} warnings={pricingWarnings}>
          <Row
            label="Mode"
            value={
              <Badge variant="outline" className="capitalize">
                {data.pricingMode?.replace('_', ' ')}
              </Badge>
            }
          />
          <Row label="Rental Price" value={pricingLabel} />
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
          {data.extendedRentalRate && <Row label="Extended Rate" value={`৳${data.extendedRentalRate}/day`} />}
          {data.lateFeeType === 'fixed' && data.lateFeePerDay && (
            <Row label="Late Fee" value={`৳${data.lateFeePerDay}/day (Fixed)`} />
          )}
          {data.lateFeeType === 'percentage' && data.lateFeePercentage && (
            <Row label="Late Fee" value={`${data.lateFeePercentage}%/day`} />
          )}
          {data.maxLateFeeCap && <Row label="Max Late Fee Cap" value={`৳${data.maxLateFeeCap}`} />}
          
          <div className="border-t mt-2 pt-2">
            <Row label="Security Deposit" value={data.securityDeposit ? `৳${data.securityDeposit}` : 'None'} />
            <Row label="Cleaning Fee" value={data.cleaningFee ? `৳${data.cleaningFee}` : 'None'} />
            <Row label="Backup Size" value={data.enableBackupSize ? `Yes (৳${data.backupSizeFee || 0})` : 'No'} />
            <Row
              label="Try-On"
              value={
                data.enableTryOn
                  ? `Yes (৳${data.tryOnFee || 0}, ${data.tryOnDuration || '?'} days${data.creditTryOnFee ? ', credited' : ''})`
                  : 'No'
              }
            />
          </div>
        </ReviewCard>

        {/* ── Size & Details ───────────────────────────────── */}
        <ReviewCard title="Size & Details" icon={Ruler} step={3} onGoToStep={onGoToStep} warnings={sizeWarnings}>
          <Row
            label="Size Mode"
            value={
              <Badge variant="outline" className="capitalize">
                {data.sizeMode?.replace('_', ' ')}
              </Badge>
            }
          />
          {data.sizeMode === 'standard' && data.availableSizes && data.availableSizes.length > 0 && (
            <div className="pt-1">
              <span className="font-medium text-muted-foreground text-xs">Available Sizes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.availableSizes.map((s) => (
                  <Badge key={s} variant={s === data.mainDisplaySize ? 'default' : 'outline'} className="text-[10px]">
                    {s}{s === data.mainDisplaySize ? ' ★' : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {data.sizeMode === 'free' && data.freeSizeType && (
            <Row label="Type" value={<span className="capitalize">{data.freeSizeType.replace('_', ' ')}</span>} />
          )}
          {data.measurements && data.measurements.length > 0 && (
            <div className="pt-1">
              <span className="font-medium text-muted-foreground text-xs">Measurements:</span>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {data.measurements.map((m, i) => (
                  <span key={i} className="text-xs text-muted-foreground">
                    {m.label}: {m.value} {m.unit}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.sizeMode === 'multi_part' && data.parts && data.parts.length > 0 && (
            <div className="pt-1">
              <span className="font-medium text-muted-foreground text-xs">Parts:</span>
              <div className="space-y-0.5 mt-1">
                {data.parts.map((p, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium">{p.partName || 'Unnamed'}</span>
                    {p.measurements?.length > 0 && (
                      <span> — {p.measurements.map(m => `${m.label}: ${m.value} ${m.unit}`).join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.sizeChartUrl && <Row label="Size Chart" value="Provided ✓" />}

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
