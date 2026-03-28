'use client';

import { useCategoryRevenue } from '../hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export function CategoryDistribution() {
  const { data: response, isLoading } = useCategoryRevenue();
  
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Revenue by Category</CardTitle>
          <CardDescription>Loading distribution...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center animate-pulse bg-muted/20">
          <div className="w-[200px] h-[200px] rounded-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const data = response?.data || [];

  return (
    <Card className="col-span-1 shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle>Revenue by Category</CardTitle>
        <CardDescription>Distribution of booking revenue</CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl mt-4">
            No category data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="revenue"
                nameKey="category"
                stroke="none"
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                layout="vertical" 
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value, entry: any) => (
                  <span className="text-sm font-medium text-gray-700">
                    {value} <span className="text-gray-400 text-xs ml-1">({entry.payload.percentage}%)</span>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
