/**
 * Format an integer price for display.
 * Per ADR-04: All prices are stored as integers (no decimals).
 * Example: 7500 → "7,500"
 *
 * Note: This is a backend utility for logging/notifications.
 * Primary display formatting happens in the frontend via formatPrice().
 */
export function formatPrice(amount: number): string {
  return amount.toLocaleString('en-US');
}

/**
 * Calculate percentage of an amount, always rounding UP (ADR-04).
 * Example: calculatePercentage(7500, 3.5) → 263
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return Math.ceil((amount * percentage) / 100);
}
