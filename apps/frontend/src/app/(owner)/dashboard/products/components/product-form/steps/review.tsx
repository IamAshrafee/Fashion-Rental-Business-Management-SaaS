import { useFormContext } from 'react-hook-form';
import { ProductFormValues } from '../schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function ReviewStep() {
  const { watch } = useFormContext<ProductFormValues>();
  const data = watch();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Review & Submit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your product details before publishing.
        </p>
      </div>

      <Alert variant="default" className="bg-primary/5 border-primary/20">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle>Ready to publish</AlertTitle>
        <AlertDescription>
          Your product form is complete. You can submit it now, or go back to make changes.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Name</span>
              <span className="text-right">{data.name || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Status</span>
              <span className="text-right capitalize">{data.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Category ID</span>
              <span className="text-right">{data.categoryId || 'Not set'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variants & Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Variants Count</span>
              <span className="text-right">{data.variants?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Total Images Setup</span>
              <span className="text-right">
                {data.variants?.reduce((acc, v) => acc + (v.images?.length || 0), 0) || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Pricing Mode</span>
              <span className="text-right">{data.pricingMode?.replace('_', ' ')}</span>
            </div>
            {data.pricingMode === 'one_time' && (
              <div className="flex justify-between">
                <span className="font-semibold">Rental Price</span>
                <span className="text-right">৳{data.rentalPrice || 0}</span>
              </div>
            )}
            {data.pricingMode === 'per_day' && (
              <div className="flex justify-between">
                <span className="font-semibold">Price per Day</span>
                <span className="text-right">৳{data.pricePerDay || 0}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-semibold">Shipping Mode</span>
              <span className="text-right capitalize">{data.shippingMode?.replace('_', ' ')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Security Deposit</span>
              <span className="text-right">{data.securityDeposit ? `৳${data.securityDeposit}` : 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Cleaning Fee</span>
              <span className="text-right">{data.cleaningFee ? `৳${data.cleaningFee}` : 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Backup Size</span>
              <span className="text-right">{data.enableBackupSize ? `Yes (৳${data.backupSizeFee || 0})` : 'No'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
