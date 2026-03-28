'use client';

import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Edit, Copy, ExternalLink, Archive, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;

  // Mock data for display
  const product = {
    id,
    name: 'Royal Banarasi Silk Saree',
    status: 'published',
    category: 'Saree',
    pricingMode: 'one_time',
    rentalPrice: 3500,
    securityDeposit: 5000,
    cleaningFee: 500,
    totalRentals: 15,
    revenue: 52500,
    createdAt: '2025-10-12',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link href="/dashboard/products">
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Back to products</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              <Badge variant="default" className="bg-green-600">Published</Badge>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-4">
              <span>ID: {product.id}</span>
              <span className="flex items-center hover:text-foreground cursor-pointer transition-colors">
                <Copy className="h-3 w-3 mr-1" /> Copy ID
              </span>
              <span className="flex items-center text-primary hover:underline cursor-pointer transition-colors">
                <ExternalLink className="h-3 w-3 mr-1" /> View on Store
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/products/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button variant="secondary">
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button variant="destructive" size="icon">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content column */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Image Gallery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 overflow-x-auto pb-2">
                <div className="h-40 w-40 shrink-0 rounded-md bg-muted border flex items-center justify-center">
                  <span className="text-muted-foreground">Thumbnail</span>
                </div>
                <div className="h-40 w-40 shrink-0 rounded-md bg-muted border flex items-center justify-center">
                  <span className="text-muted-foreground">Variant 1</span>
                </div>
                <div className="h-40 w-40 shrink-0 rounded-md bg-muted/50 border flex items-center justify-center border-dashed cursor-pointer hover:bg-muted">
                  <span className="text-muted-foreground">+ Add Image</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row space-y-0 items-center justify-between pb-2">
              <CardTitle>Details & Logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Category</div>
                  <div className="font-medium">{product.category}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Created At</div>
                  <div className="font-medium">{product.createdAt}</div>
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Rental Price</div>
                  <div className="font-medium text-base">৳{product.rentalPrice}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Security Deposit</div>
                  <div className="font-medium text-base">৳{product.securityDeposit}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Cleaning Fee</div>
                  <div className="font-medium text-base">৳{product.cleaningFee}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar content */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-green-600">৳{(product.revenue).toLocaleString()}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Total Rentals</div>
                <div className="text-xl font-bold">{product.totalRentals}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200">
                <div className="bg-blue-100 p-2 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Available in Stock</div>
                  <div className="text-xs opacity-80">Ready to rent immediately</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
