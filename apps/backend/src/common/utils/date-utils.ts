/**
 * Date utility functions.
 * Uses native Date methods — no moment.js (project rule: use date-fns if needed).
 */

/**
 * Get the number of days between two dates (inclusive).
 * Used for rental duration calculations.
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffMs / msPerDay) + 1;
}

/**
 * Add days to a date and return a new Date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if two date ranges overlap.
 * Used for availability checking.
 */
export function dateRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  return start1 <= end2 && start2 <= end1;
}

/**
 * Get today's date as a plain date string (YYYY-MM-DD).
 * Per ADR-05: Booking dates are calendar dates, not timestamps.
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
