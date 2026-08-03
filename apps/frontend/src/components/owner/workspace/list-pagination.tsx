'use client';

import type { MouseEvent } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface OwnerListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  isPending?: boolean;
  onPageChange: (page: number) => void;
}

function pageWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) return [1, 2, 3, 4, 'ellipsis', totalPages];
  if (page >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
}

export function OwnerListPagination({
  page,
  totalPages,
  total,
  pageSize,
  isPending = false,
  onPageChange,
}: OwnerListPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  const navigate = (targetPage: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!isPending && targetPage >= 1 && targetPage <= safeTotalPages && targetPage !== page) {
      onPageChange(targetPage);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {firstResult}–{lastResult} of {total}
      </p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page <= 1 || isPending}
              className={cn((page <= 1 || isPending) && 'pointer-events-none opacity-50')}
              onClick={navigate(page - 1)}
            />
          </PaginationItem>
          {pageWindow(page, safeTotalPages).map((item, index) => (
            item === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item} className="hidden sm:list-item">
                <PaginationLink
                  href="#"
                  isActive={item === page}
                  aria-label={`Go to page ${item}`}
                  onClick={navigate(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            )
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= safeTotalPages || isPending}
              className={cn(
                (page >= safeTotalPages || isPending) && 'pointer-events-none opacity-50',
              )}
              onClick={navigate(page + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
