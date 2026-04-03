'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package } from 'lucide-react';
import Image from 'next/image';

interface TopProduct {
  id: string;
  name: string;
  image: string | null;
  count: number;
}

interface DashboardTopProductsProps {
  products: TopProduct[];
  className?: string;
}

export function DashboardTopProducts({ products, className }: DashboardTopProductsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
        <CardDescription>Most frequently rented items</CardDescription>
      </CardHeader>
      <CardContent>
        {(!products || products.length === 0) ? (
          <div className="flex h-[250px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p>No rentals yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {products.map((product) => (
              <div key={product.id} className="flex items-center">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="ml-4 space-y-1 overflow-hidden">
                  <p className="truncate text-sm font-medium leading-none">
                    {product.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {product.count} {product.count === 1 ? 'rental' : 'rentals'}
                  </p>
                </div>
                <div className="ml-auto font-medium text-sm text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  Popular
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
