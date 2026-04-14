import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import type { TrafficFunnel } from '@closetrent/types';

export function FunnelChart({ data }: { data?: TrafficFunnel }) {
  if (!data?.nodes || data.nodes.length === 0) return null;

  const getBarColor = (index: number) => {
    const defaultClasses = ['#000000', '#f97316', '#fbbf24']; // black, orange, yellow
    return defaultClasses[index] || '#000000';
  };

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Buyer Intent Funnel</CardTitle>
        <CardDescription>Visualizing how much traffic converts into checkout intents.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-[100%] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.nodes}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis 
                dataKey="step" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                width={120}
                tick={{ fontSize: 13, fontWeight: 500, fill: '#333' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const node = payload[0].payload;
                    return (
                      <div className="bg-white border rounded shadow-sm p-3 text-sm">
                        <p className="font-bold text-gray-900 mb-1">{node.step}</p>
                        <p className="text-gray-600">Count: <span className="font-semibold text-black">{node.count}</span></p>
                        {node.dropOffRate > 0 && (
                          <p className="text-red-500 font-medium text-xs mt-1">
                            -{node.dropOffRate}% drop-off
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={40}>
                {data.nodes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
