import type { ProductFormValues } from './schema';

export function buildPricingPayload(data: ProductFormValues) {
  const components: Array<{
    type: string;
    config: Record<string, unknown>;
    chargeTiming: string;
    refundable: boolean;
  }> = data.pricingComponents.map((component) => ({
    type: component.type === 'ADDON_BACKUP' || component.type === 'ADDON_TRYON'
      ? 'ADDON'
      : component.type,
    config: {
      ...component.config,
      ...(component.type === 'ADDON_BACKUP'
        ? { purpose: 'BACKUP_SIZE', addonId: 'BACKUP_SIZE' }
        : component.type === 'ADDON_TRYON'
          ? { purpose: 'TRY_ON', addonId: 'TRY_ON' }
          : {}),
    },
    chargeTiming: 'AT_BOOKING',
    refundable: component.type === 'DEPOSIT',
  }));

  if (data.shippingMode === 'flat' && (data.flatShippingFee ?? 0) > 0) {
    components.push({
      type: 'FEE',
      config: {
        label: 'Delivery fee',
        purpose: 'DELIVERY',
        pricing: { mode: 'FLAT', amountMinor: data.flatShippingFee },
      },
      chargeTiming: 'AT_BOOKING',
      refundable: false,
    });
  }

  return {
    ratePlan: { type: data.ratePlanType, config: data.ratePlanConfig },
    components,
    lateFeePolicy: data.lateFeeEnabled
      ? {
          enabled: true,
          graceHours: data.lateFeeGraceHours || 24,
          mode: 'PER_DAY' as const,
          amountMinor: data.lateFeeAmountMinor || 0,
          totalCapMinor: data.lateFeeCapMinor || undefined,
        }
      : { enabled: false, graceHours: 0, mode: 'PER_DAY' as const },
  };
}
