import { Suspense } from 'react';
import { OwnerTableSkeleton } from '@/components/owner/workspace';
import { CatalogPageClient } from './components/product-list/catalog-page-client';

export default function ProductsPage() {
  return (
    <Suspense fallback={<OwnerTableSkeleton columns={7} />}>
      <CatalogPageClient />
    </Suspense>
  );
}
