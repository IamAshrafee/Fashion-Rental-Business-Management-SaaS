'use client';

import { useLocale } from '@/hooks/use-locale';

interface PriceDisplayProps {
  /** Integer amount (ADR-04) */
  amount: number;
  className?: string;
}

/**
 * Renders a formatted price using the tenant's currency settings.
 * Money values are always integers — formatting is frontend-only.
 */
export function PriceDisplay({ amount, className }: PriceDisplayProps) {
  const { formatPrice } = useLocale();
  return <span className={className}>{formatPrice(amount)}</span>;
}
