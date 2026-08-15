export interface PricingConfigDisplayEntry {
  key: string;
  label: string;
  value: string | number | boolean;
  isMoney: boolean;
}

type PrimitivePricingValue = string | number | boolean;

function isPrimitivePricingEntry(
  entry: [string, unknown],
): entry is [string, PrimitivePricingValue] {
  const [, value] = entry;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

const PRICING_LABELS: Record<string, string> = {
  unitPriceMinor: 'Daily rental price',
  flatPriceMinor: 'Rental package price',
  extraDayPriceMinor: 'Extra day price',
  dailyPriceMinor: 'Daily rental price',
  weeklyPriceMinor: 'Weekly rental price',
  monthlyPriceMinor: 'Monthly rental price',
  minPriceMinor: 'Starting rental price',
  minDays: 'Minimum rental days',
  maxDays: 'Maximum rental days',
  includedDays: 'Included rental days',
};

export function getPricingConfigDisplayEntries(
  config: Record<string, unknown>,
): PricingConfigDisplayEntry[] {
  return Object.entries(config)
    .filter(isPrimitivePricingEntry)
    .map(([key, value]) => ({
      key,
      label: PRICING_LABELS[key] ?? key.replace(/Minor$/, '').replace(/([A-Z])/g, ' $1'),
      value,
      isMoney: key.endsWith('Minor') && typeof value === 'number',
    }));
}
