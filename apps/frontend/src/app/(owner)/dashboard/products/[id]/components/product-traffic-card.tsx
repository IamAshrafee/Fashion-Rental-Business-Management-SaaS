'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Loader2, Users, ShoppingCart, Percent } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function ProductTrafficCard({ productId }: { productId: string }) {
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['product-traffic', productId],
    queryFn: () => analyticsApi.getStorefrontSummary({ productId }),
  });

  const summary = summaryData?.data;

  if (isLoading) {
    return (
      <Card className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4" /> Storefront activity
        </CardTitle>
        <CardDescription>Customer interest and add-to-cart performance during the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center mb-1 text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              <span className="text-xs">Visitors</span>
            </div>
            <div className="text-xl font-bold">{summary.uniqueVisitors.toLocaleString()}</div>
          </div>
          <div className="border-x">
            <div className="flex items-center justify-center mb-1 text-muted-foreground">
              <ShoppingCart className="h-3 w-3 mr-1" />
              <span className="text-xs">Cart adds</span>
            </div>
            <div className="text-xl font-bold">{summary.cartAdds.toLocaleString()}</div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-1 text-muted-foreground">
              <Percent className="h-3 w-3 mr-1" />
              <span className="text-xs">Conversion</span>
            </div>
            <div className="text-xl font-bold text-primary">{summary.cartConversionRate}%</div>
          </div>
        </div>

        {summary.uniqueVisitors > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>View-to-Cart Funnel</span>
              <span>{Math.round(summary.cartConversionRate)}% placed in cart</span>
            </div>
            <Progress value={summary.cartConversionRate} className="h-2 bg-primary/10" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
