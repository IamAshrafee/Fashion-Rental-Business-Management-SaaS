'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  AlertCircle,
  Eye,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OwnerListPagination } from '@/components/owner/workspace';
import type { PaginationMeta, ProductStatus } from '@closetrent/types';
import type { ProductListItem } from '@/lib/api/products';
import {
  useSoftDeleteProduct,
  useUpdateProductStatus,
} from '../../hooks/use-product-apis';

const moneyFormatter = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
});

function StatusBadge({ status }: { status: ProductStatus }) {
  if (status === 'published') return <Badge>Published</Badge>;
  if (status === 'draft') return <Badge variant="secondary">Draft</Badge>;
  return <Badge variant="outline">Archived</Badge>;
}

function TrackingBadge({ mode }: { mode: ProductListItem['trackingMode'] }) {
  const labels: Record<ProductListItem['trackingMode'], string> = {
    NONE: 'Not configured',
    POOLED: 'Pooled',
    SERIALIZED: 'Physical items',
    MIXED: 'Mixed',
  };
  return <Badge variant="outline">{labels[mode]}</Badge>;
}

function Readiness({ product }: { product: ProductListItem }) {
  if (product.readiness.ready) {
    return <Badge variant="secondary">Ready</Badge>;
  }
  const [firstBlocker, ...remainingBlockers] = product.readiness.blockers;
  return (
    <div className="flex max-w-48 flex-col items-start gap-1">
      <Badge variant="outline"><AlertCircle data-icon="inline-start" />Needs attention</Badge>
      <span className="text-xs text-muted-foreground">
        {firstBlocker?.message}
        {remainingBlockers.length > 0 ? ` +${remainingBlockers.length} more` : ''}
      </span>
    </div>
  );
}

function ProductActions({ product }: { product: ProductListItem }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const softDelete = useSoftDeleteProduct();
  const updateStatus = useUpdateProductStatus();
  const isPublished = product.status === 'published';
  const statusMutationPending = updateStatus.isPending && updateStatus.variables?.id === product.id;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${product.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{product.name}</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/products/${product.id}`}><Eye data-icon="inline-start" />View product</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={product.onboarding && product.status === 'draft'
                ? `/dashboard/products/new?productId=${product.id}`
                : `/dashboard/products/${product.id}/edit`}>
                <Pencil data-icon="inline-start" />
                {product.onboarding && product.status === 'draft' ? 'Continue setup' : 'Edit catalog'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/products/${product.id}/inventory`}><Boxes data-icon="inline-start" />Manage inventory</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={statusMutationPending || (!isPublished && (
                !product.readiness.ready
                || Boolean(product.onboarding && !product.onboarding.completedSections.includes('REVIEW'))
              ))}
              onClick={() => updateStatus.mutate({
                id: product.id,
                status: isPublished ? 'draft' : 'published',
              })}
            >
              {statusMutationPending ? <Loader2 className="animate-spin" /> : isPublished ? <Undo2 /> : <Send />}
              {isPublished
                ? 'Unpublish to draft'
                : product.onboarding && !product.onboarding.completedSections.includes('REVIEW')
                  ? 'Continue setup to publish'
                  : product.readiness.ready
                    ? 'Publish product'
                    : 'Complete setup to publish'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={softDelete.isPending}
              onSelect={() => setConfirmOpen(true)}
            >
              <Trash2 />Move to trash
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move “{product.name}” to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will leave the active catalog and can be restored later. Products with
              active or upcoming bookings cannot be moved to trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={softDelete.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={softDelete.isPending}
              onClick={() => softDelete.mutate(product.id, {
                onSettled: () => setConfirmOpen(false),
              })}
            >
              {softDelete.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProductIdentity({ product }: { product: ProductListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0">
        <Link href={`/dashboard/products/${product.id}`} className="block truncate font-medium hover:underline">
          {product.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {product.category.name} · {product.productType?.name ?? 'No product type'}
        </p>
      </div>
    </div>
  );
}

export function ProductsDataTable({
  data,
  meta,
  isPending,
  onPageChange,
}: {
  data: ProductListItem[];
  meta: PaginationMeta;
  isPending: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col divide-y md:hidden">
        {data.map((product) => (
          <article key={product.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <ProductIdentity product={product} />
              <ProductActions product={product} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={product.status as ProductStatus} />
              <TrackingBadge mode={product.trackingMode} />
              <Readiness product={product} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-muted-foreground">SKUs</p><p className="font-medium">{product.skuCount}</p></div>
              <div><p className="text-muted-foreground">On hand</p><p className="font-medium">{product.inventory.onHand}</p></div>
              <div><p className="text-muted-foreground">Price</p><p className="font-medium">{moneyFormatter.format(product.rentalPrice / 100)}</p></div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-64">Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Readiness</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Catalog</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((product) => (
              <TableRow key={product.id}>
                <TableCell><ProductIdentity product={product} /></TableCell>
                <TableCell><StatusBadge status={product.status as ProductStatus} /></TableCell>
                <TableCell><Readiness product={product} /></TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">{product.inventory.onHand} on hand</span>
                    <TrackingBadge mode={product.trackingMode} />
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{product.variantCount} variants · {product.skuCount} SKUs</span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {moneyFormatter.format(product.rentalPrice / 100)}
                </TableCell>
                <TableCell className="w-12"><ProductActions product={product} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OwnerListPagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        pageSize={meta.limit}
        isPending={isPending}
        onPageChange={onPageChange}
      />
    </div>
  );
}
