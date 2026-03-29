'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Edit, Copy, ExternalLink, Archive, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { productApi } from '@/lib/api/products';
import { useState } from 'react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });

  const archiveMutation = useMutation({
    mutationFn: () => productApi.archive(id),
    onSuccess: () => {
      toast.success('Product archived');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to archive'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => productApi.softDelete(id),
    onSuccess: () => {
      toast.success('Product moved to trash');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/dashboard/products');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
  });

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    toast.success('Product ID copied');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>
          Failed to load product. {(error as Error)?.message || 'Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  const statusBadge = (() => {
    switch (product.status) {
      case 'published': return <Badge variant="default" className="bg-green-600">Published</Badge>;
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'archived': return <Badge variant="destructive">Archived</Badge>;
      default: return <Badge variant="outline">{product.status}</Badge>;
    }
  })();

  // Collect all images from all variants
  const allImages = product.variants?.flatMap(v => v.images || []) || [];

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
              {statusBadge}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-4">
              <span>ID: {product.id.slice(0, 8)}...</span>
              <button onClick={handleCopyId} className="flex items-center hover:text-foreground cursor-pointer transition-colors">
                <Copy className="h-3 w-3 mr-1" /> Copy ID
              </button>
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
          <Button
            variant="secondary"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Archive
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
          >
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
                {allImages.length > 0 ? (
                  allImages.map((img) => (
                    <div key={img.id} className="h-40 w-40 shrink-0 rounded-md bg-muted border overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={product.name} className="object-cover w-full h-full" />
                      {img.isFeatured && (
                        <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Featured</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="h-40 w-40 shrink-0 rounded-md bg-muted border flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">No images</span>
                  </div>
                )}
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
                  <div className="font-medium">{product.category?.name || 'Uncategorized'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Created At</div>
                  <div className="font-medium">{format(new Date(product.createdAt), 'MMM d, yyyy')}</div>
                </div>
                {product.supplierName && (
                  <div>
                    <div className="text-muted-foreground mb-1">Supplier</div>
                    <div className="font-medium">{product.supplierName}</div>
                  </div>
                )}
                {product.purchasePrice && (
                  <div>
                    <div className="text-muted-foreground mb-1">Purchase Price</div>
                    <div className="font-medium">৳{product.purchasePrice.toLocaleString()}</div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Rental Price</div>
                  <div className="font-medium text-base">৳{(product.rentalPrice ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Security Deposit</div>
                  <div className="font-medium text-base">৳{(product.securityDeposit ?? 0).toLocaleString()}</div>
                </div>
                {product.cleaningFeeEnabled && (
                  <div>
                    <div className="text-muted-foreground mb-1">Cleaning Fee</div>
                    <div className="font-medium text-base">৳{(product.cleaningFee ?? 0).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Variants ({product.variants.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {product.variants.map(v => (
                    <div key={v.id} className="flex items-center gap-3 p-3 border rounded-md">
                      {v.colorHex && (
                        <div className="h-6 w-6 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: v.colorHex }} />
                      )}
                      <div>
                        <div className="font-medium text-sm">{v.colorName}</div>
                        <div className="text-xs text-muted-foreground">{v.images?.length || 0} images</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
                <div className="text-2xl font-bold text-green-600">৳{(product.revenue ?? 0).toLocaleString()}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Total Bookings</div>
                <div className="text-xl font-bold">{product.totalBookings ?? 0}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Target Rentals</div>
                <div className="text-xl font-bold">{product.targetRentals || 'Not set'}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {product.status === 'published' ? 'Available in Stock' : product.status === 'draft' ? 'Draft — Not Live' : 'Archived'}
                  </div>
                  <div className="text-xs opacity-80">
                    {product.status === 'published' ? 'Ready to rent immediately' : product.status === 'draft' ? 'Publish to make visible' : 'Not visible to customers'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Move to trash?"
        description="This product will be moved to the trash bin. You can restore it later."
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Move to Trash'}
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function format(date: Date, fmt: string): string {
  // Simple date formatter
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (fmt === 'MMM d, yyyy') {
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
  return date.toLocaleDateString();
}
