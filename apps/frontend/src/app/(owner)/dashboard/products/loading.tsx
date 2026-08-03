import { Skeleton } from '@/components/ui/skeleton';
import { OwnerTableSkeleton } from '@/components/owner/workspace';

export default function ProductsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-28 w-full" />
      <OwnerTableSkeleton columns={7} />
    </div>
  );
}
