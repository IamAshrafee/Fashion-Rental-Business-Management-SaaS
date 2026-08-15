'use client';

import { useRevenueSeries } from '../hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { formatMinorMoney } from '@/lib/money';

export function RevenueChart({ dateRange }: { dateRange: { from?: string; to?: string } }) {
  const { data: response, isLoading } = useRevenueSeries(dateRange);

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Booked Rental Value</CardTitle>
          <CardDescription>Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center animate-pulse bg-muted/20">
          <div className="h-4/5 w-11/12 bg-muted rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const data = response?.data;
  
  const chartData = data?.series?.map((item) => ({
    ...item,
    formattedDate: format(new Date(item.date), 'MMM d'),
  })) || [];

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle>Booked Rental Value Trend</CardTitle>
          <CardDescription>
            {formatMinorMoney(data?.total)} across non-pending, non-cancelled bookings in this period
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="h-[350px] w-full mt-4">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
            No revenue recorded in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="formattedDate" 
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                style={{ fontSize: '12px', fill: '#6B7280' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                tickFormatter={(value) => formatMinorMoney(Number(value))}
                style={{ fontSize: '12px', fill: '#6B7280' }}
              />
              <Tooltip 
                formatter={(value) => [formatMinorMoney(Number(value)), 'Booked rental value']}
                labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#10b981' }}
                activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
