'use client';

import { useLocale } from '@/hooks/use-locale';

interface DateDisplayProps {
  /** Date string or object to format */
  date: Date | string;
  /** Whether to include time portion */
  showTime?: boolean;
  className?: string;
}

/**
 * Renders a formatted date using the tenant's locale settings.
 */
export function DateDisplay({ date, showTime = false, className }: DateDisplayProps) {
  const { formatDate, formatDateTime } = useLocale();
  const formatted = showTime ? formatDateTime(date) : formatDate(date);
  return <span className={className}>{formatted}</span>;
}
