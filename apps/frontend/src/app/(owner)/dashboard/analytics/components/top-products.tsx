'use client';

import { useTopProducts } from '../hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, TrendingUp } from 'lucide-react';

export function TopProducts({ sortBy = 'revenue' }: { sortBy?: 'bookings' | 'revenue' }) {
  const { data: response, isLoading } = useTopProducts({ sortBy, limit: 5 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card className="col-span-1 border shadow-sm">
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Loading top performers...</CardDescription>
        </CardHeader>
        <CardContent className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex grid-cols-[1fr_auto] items-center gap-4">
              <div className="w-10 h-10 rounded-md bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/4 bg-muted rounded" />
              </div>
              <div className="h-4 w-12 bg-muted rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const products = response?.data || [];

  return (
    <Card className="col-span-1 border shadow-sm flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Top Products
        </CardTitle>
        <CardDescription>Highest {sortBy === 'revenue' ? 'revenue generating' : 'booked'} items</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden h-full flex flex-col">
        {products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl p-4">
            No products booked in this period
          </div>
        ) : (
          <div className="space-y-5">
            {products.map((product: any, index: number) => (
              <div key={product.productId} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors -ml-2">
                <div className="relative flex shrink-0 items-center justify-center font-bold text-gray-400 w-6">
                  {index + 1}.
                </div>
                {product.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.thumbnailUrl}
                    alt={product.name}
                    className="h-10 w-10 rounded-md object-cover border"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted/50 flex flex-col items-center justify-center border text-xs text-muted-foreground uppercase">
                    IMG
                  </div>
                )}
                
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{product.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><TrendingUp size={10} /> {product.totalBookings} times</span>
                    <span>•</span>
                    <span>{product.utilizationRate}% utilized</span>
                  </div>
                </div>
                
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold text-sm text-emerald-600">
                    {formatCurrency(product.totalRevenue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
