export const MINOR_UNITS_PER_MAJOR = 100;

export function formatMinorMoney(value: unknown, currency = 'BDT') {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / MINOR_UNITS_PER_MAJOR);
}

export function minorToMajorInput(value: unknown): number | '' {
  return typeof value === 'number' && Number.isFinite(value)
    ? value / MINOR_UNITS_PER_MAJOR
    : '';
}

export function majorInputToMinor(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  const minor = Math.round((parsed + Number.EPSILON) * MINOR_UNITS_PER_MAJOR);
  return Number.isSafeInteger(minor) ? minor : undefined;
}
