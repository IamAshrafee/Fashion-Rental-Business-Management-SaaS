import type { BatchInventoryItemInput } from '@/lib/api/inventory';
import type { StockConditionGrade } from '@/lib/api/inventory-operations';

export interface RegistrationRow {
  assetCode: string;
  barcode: string;
  condition: '' | StockConditionGrade;
  acquisitionDate: string;
  acquisitionCost: string;
  acquisitionSource: string;
  acquisitionReference: string;
  notes: string;
}

export interface RegistrationDefaults {
  condition: StockConditionGrade;
  acquisitionDate: string;
  acquisitionCost: string;
  acquisitionSource: string;
  acquisitionReference: string;
  notes: string;
}

export function blankRegistrationRow(assetCode = ''): RegistrationRow {
  return {
    assetCode,
    barcode: '',
    condition: '',
    acquisitionDate: '',
    acquisitionCost: '',
    acquisitionSource: '',
    acquisitionReference: '',
    notes: '',
  };
}

export function generateAssetCodes(prefix: string, start: number, count: number) {
  const normalized = prefix.trim().replace(/-+$/, '').toUpperCase();
  if (!normalized) return Array.from({ length: count }, () => '');
  return Array.from(
    { length: count },
    (_, index) => `${normalized}-${String(start + index).padStart(3, '0')}`,
  );
}

function optionalText(value: string) {
  return value.trim() || undefined;
}

function optionalMinor(value: string) {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

export function buildRegistrationPayload(input: {
  locationId: string;
  defaults: RegistrationDefaults;
  rows: RegistrationRow[];
  idempotencyKey: string;
  componentStates: BatchInventoryItemInput['componentStates'];
}): BatchInventoryItemInput {
  return {
    locationId: input.locationId,
    condition: input.defaults.condition,
    acquisitionDate: input.defaults.acquisitionDate || undefined,
    acquisitionCost: optionalMinor(input.defaults.acquisitionCost),
    acquisitionSource: optionalText(input.defaults.acquisitionSource),
    acquisitionReference: optionalText(input.defaults.acquisitionReference),
    notes: optionalText(input.defaults.notes),
    rows: input.rows.map((row) => ({
      assetCode: row.assetCode.trim(),
      barcode: optionalText(row.barcode),
      condition: row.condition || undefined,
      acquisitionDate: row.acquisitionDate || undefined,
      acquisitionCost: optionalMinor(row.acquisitionCost),
      acquisitionSource: optionalText(row.acquisitionSource),
      acquisitionReference: optionalText(row.acquisitionReference),
      notes: optionalText(row.notes),
    })),
    componentStates: input.componentStates,
    idempotencyKey: input.idempotencyKey,
  };
}
