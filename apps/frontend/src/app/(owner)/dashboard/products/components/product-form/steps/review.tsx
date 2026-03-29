'use client';

import { useFormContext } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Edit2 } from 'lucide-react';
import { useCategories, useEvents } from '../../../hooks/use-product-apis';
import { useColors } from '../../../hooks/use-product-apis';
import { Button } from '@/components/ui/button';

interface ReviewStepProps {
  onGoToStep?: (step: number) => void;
}

export function ReviewStep({ onGoToStep }: ReviewStepProps) {
  const { watch } = useFormContext<ProductFormValues>();
  const data = watch();

  const { data: categories } = useCategories();
  const { data: events } = useEvents();
  const { data: colors } = useColors();

  // Resolve names
  const categoryName = categories?.find((c) => c.id === data.categoryId)?.name || 'Not set';
  const currentCategory = categories?.find((c) => c.id === data.categoryId);
  const subcategoryName = currentCategory?.subcategories?.find((s: any) => s.id === data.subcategoryId)?.name;
  const selectedEvents = events?.filter((e) => data.events?.includes(e.id)).map((e) => e.name) || [];

  // Pricing label
  const pricingLabel = (() => {
    switch (data.pricingMode) {
      case 'one_time':
        return `৳${data.rentalPrice || 0} for ${data.includedDays || '?'} days`;
      case 'per_day':
        return `৳${data.pricePerDay || 0}/day (min ${data.minimumDays || 1} days)`;
      case 'percentage':
        return `${data.rentalPercentage || 0}% of ৳${data.retailPrice || 0} = ৳${Math.round((data.retailPrice || 0) * (data.rentalPercentage || 0) / 100)}`;
      default:
        return 'Not configured';
    }
  })();

  const totalImages = data.variants?.reduce((acc, v) => acc + (v.images?.length || 0), 0) || 0;

  const EditButton = ({ step }: { step: number }) => {
    if (!onGoToStep) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => onGoToStep(step)}
      >
        <Edit2 className="h-3 w-3 mr-1" />
        Edit
      </Button>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Review & Submit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your product details before publishing. Click &quot;Edit&quot; on any section to make changes.
        </p>
      </div>

      <Alert variant="default" className="bg-primary/5 border-primary/20">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle>Ready to publish</AlertTitle>
        <AlertDescription>
          Your product form is complete. Click &quot;Publish Product&quot; below to submit.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Basic Info</CardTitle>
            <EditButton step={0} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={data.name || 'Not set'} />
            <Row label="Category" value={categoryName} />
            {subcategoryName && <Row label="Subcategory" value={subcategoryName} />}
            <Row label="Status" value={<Badge variant={data.status === 'published' ? 'default' : 'secondary'} className="capitalize">{data.status}</Badge>} />
            {selectedEvents.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="font-medium text-muted-foreground">Events</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                  {selectedEvents.map((name) => (
                    <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                  ))}
                </div>
              </div>
            )}
            {data.targetRentals && <Row label="Target Rentals" value={data.targetRentals.toString()} />}
            {data.purchasePrice && <Row label="Purchase Price" value={`৳${data.purchasePrice}`} />}
            {data.itemCountry && <Row label="Country" value={data.itemCountry} />}
          </CardContent>
        </Card>

        {/* Variants & Images */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variants & Images</CardTitle>
            <EditButton step={1} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total Variants" value={String(data.variants?.length || 0)} />
            <Row label="Total Images" value={String(totalImages)} />

            {data.variants?.map((v, idx) => {
              const mainColor = colors?.find((c) => c.id === v.mainColorId);
              const imageCount = v.images?.length || 0;
              return (
                <div key={idx} className="flex items-center justify-between py-1.5 border-t first:border-t-0">
                  <div className="flex items-center gap-2">
                    {mainColor?.hex && (
                      <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: mainColor.hex }} />
                    )}
                    <span className="text-muted-foreground">{v.name || mainColor?.name || `Variant ${idx + 1}`}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">{imageCount} images</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pricing</CardTitle>
            <EditButton step={3} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
            {data.lateFeePerDay && (
              <Row label="Late Fee" value={`৳${data.lateFeePerDay}/day (${data.lateFeeType})`} />
            )}
            {data.minPrice && <Row label="Min Price Floor" value={`৳${data.minPrice}`} />}
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
            <EditButton step={5} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Security Deposit" value={data.securityDeposit ? `৳${data.securityDeposit}` : 'None'} />
            <Row label="Cleaning Fee" value={data.cleaningFee ? `৳${data.cleaningFee}` : 'None'} />
            <Row
              label="Backup Size"
              value={data.enableBackupSize ? `Yes (৳${data.backupSizeFee || 0})` : 'No'}
            />
            <Row
              label="Try-On"
              value={
                data.enableTryOn
                  ? `Yes (৳${data.tryOnFee || 0}, ${data.tryOnDuration || '?'} days${data.creditTryOnFee ? ', credited' : ''})`
                  : 'No'
              }
            />
          </CardContent>
        </Card>

        {/* Size & Measurements */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Size</CardTitle>
            <EditButton step={4} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Mode"
              value={
                <Badge variant="outline" className="capitalize">
                  {data.sizeMode?.replace('_', ' ')}
                </Badge>
              }
            />
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
            {data.sizeChartUrl && <Row label="Size Chart" value="Provided ✓" />}
          </CardContent>
        </Card>

        {/* Details & FAQ */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Details & FAQ</CardTitle>
            <EditButton step={6} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Detail Sections"
              value={String(data.details?.length || 0)}
            />
            {data.details && data.details.length > 0 && (
              <div className="space-y-0.5">
                {data.details.map((d, i) => (
                  <span key={i} className="block text-xs text-muted-foreground">
                    • {d.header || 'Untitled'} ({d.items?.length || 0} items)
                  </span>
                ))}
              </div>
            )}
            <Row label="FAQs" value={String(data.faqs?.length || 0)} />
            {data.faqs && data.faqs.length > 0 && (
              <div className="space-y-0.5">
                {data.faqs.map((f, i) => (
                  <span key={i} className="block text-xs text-muted-foreground truncate max-w-full">
                    • {f.question}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
