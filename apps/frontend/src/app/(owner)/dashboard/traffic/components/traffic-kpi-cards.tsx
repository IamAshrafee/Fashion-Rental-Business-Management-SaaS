import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Users, ShoppingCart, Percent } from 'lucide-react';
import type { StorefrontTrafficSummary } from '@closetrent/types';

export function TrafficKpiCards({ summary }: { summary?: StorefrontTrafficSummary }) {
  if (!summary) return null;

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-emerald-500';
    if (growth < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getGrowthSymbol = (growth: number) => {
    if (growth > 0) return '+';
    return '';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.uniqueVisitors.toLocaleString()}</div>
          <p className={`text-xs ${getGrowthColor(summary.growthPercentage)}`}>
            {getGrowthSymbol(summary.growthPercentage)}{summary.growthPercentage}% from previous period
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Product Views</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalViews.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Across all inventory</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Add to Carts</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.cartAdds.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Total intents generated</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cart Conversion Rate</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{summary.cartConversionRate}%</div>
          <p className="text-xs text-muted-foreground">Visitors who added an item</p>
        </CardContent>
      </Card>
    </div>
  );
}
