import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper conflict resolution.
 * Uses clsx for conditional classes + tailwind-merge for deduplication.
 *
 * Usage: cn('text-red-500', isActive && 'bg-blue-500', 'text-blue-500')
 * → 'text-blue-500 bg-blue-500' (text-red-500 properly overridden)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
