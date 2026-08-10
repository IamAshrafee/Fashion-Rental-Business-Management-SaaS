'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Layers3, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProductBySlug, type GuestProductDetail } from '@/lib/api/guest-products';
import type { CompositionRule } from '@/lib/api/fulfillment';
import { formatMinorMoney } from '@/lib/money';

export interface BundleSelection {
  compositionRuleId: string;
  productId?: string;
  variantSizeId?: string;
  quantity?: number;
  label?: string;
}

function RuleSelector({ rule, value, onChange }: { rule: CompositionRule; value?: BundleSelection; onChange: (value?: BundleSelection) => void }) {
  const optional = rule.role === 'OPTIONAL_ADDON';
  const [enabled, setEnabled] = useState(!optional || rule.isDefaultSelected || !!value);
  const productOptions = useMemo(() => [
    ...(rule.componentProduct ? [rule.componentProduct] : []),
    ...rule.alternatives.map((alternative) => alternative.product),
  ], [rule]);
  const [productId, setProductId] = useState(value?.productId || rule.componentProductId || productOptions[0]?.id || '');
  const selectedProduct = productOptions.find((product) => product.id === productId);
  const productQuery = useQuery({
    queryKey: ['guest-bundle-product', selectedProduct?.slug],
    queryFn: () => getProductBySlug(selectedProduct!.slug),
    enabled: enabled && rule.skuResolution === 'CUSTOMER_SELECTED' && !!selectedProduct?.slug,
  });
  const detail = productQuery.data as GuestProductDetail | undefined;
  const skus = useMemo(() => detail?.variants.flatMap((variant) => variant.sizes.map((size) => ({
    id: size.variantSizeId,
    label: `${variant.variantName || variant.mainColor.name} · ${size.sizeInstance.displayLabel}`,
  }))) || [], [detail]);

  useEffect(() => {
    if (!enabled) {
      onChange(undefined);
      return;
    }
    if (rule.skuResolution !== 'CUSTOMER_SELECTED') {
      onChange({ compositionRuleId: rule.id, label: rule.name });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rule.id, rule.skuResolution]);

  const selectSku = (variantSizeId: string) => onChange({
    compositionRuleId: rule.id,
    productId,
    variantSizeId,
    quantity: rule.quantity,
    label: rule.name,
  });

  return <div className={cn('rounded-xl border p-4 transition-colors', enabled ? 'border-black/20 bg-white' : 'border-black/5 bg-neutral-50')}>
    <div className="flex items-start justify-between gap-4">
      <div><p className="font-semibold text-black">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">{rule.componentProduct?.name || 'Component'} · {rule.quantity} included</p></div>
      {optional ? <button type="button" onClick={() => setEnabled((current) => !current)} className={cn('flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold', enabled ? 'bg-black text-white' : 'bg-black/5 text-black')}>
        {enabled ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{enabled ? 'Added' : 'Add'}
      </button> : <span className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Required</span>}
    </div>
    {enabled && rule.skuResolution === 'FIXED' && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">{rule.fixedVariantSize ? `${rule.fixedVariantSize.variant.variantName || rule.fixedVariantSize.variant.mainColor.name} · ${rule.fixedVariantSize.sizeInstance.displayLabel}` : 'Preconfigured by the business'}</p>}
    {enabled && rule.skuResolution === 'PARENT_DERIVED' && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">We will match this component to your selected main size.</p>}
    {enabled && rule.skuResolution === 'STAFF_SELECTED' && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">Our team will reserve the best compatible option; it can be finalized before confirmation.</p>}
    {enabled && rule.skuResolution === 'CUSTOMER_SELECTED' && <div className="mt-4 space-y-3">
      {productOptions.length > 1 && <div className="flex flex-wrap gap-2">{productOptions.map((product) => <button type="button" key={product.id} onClick={() => { setProductId(product.id); onChange(undefined); }} className={cn('rounded-lg border px-3 py-2 text-xs font-medium', product.id === productId ? 'border-black bg-black text-white' : 'border-black/10')}>{product.name}</button>)}</div>}
      {productQuery.isLoading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading available sizes…</p> : <div className="flex flex-wrap gap-2">{skus.map((sku) => <button type="button" key={sku.id} onClick={() => selectSku(sku.id)} className={cn('rounded-lg border px-3 py-2 text-xs font-medium', value?.variantSizeId === sku.id ? 'border-black bg-black text-white' : 'border-black/10 hover:border-black/30')}>{sku.label}</button>)}</div>}
      {!productQuery.isLoading && !skus.length && <p className="text-xs text-red-600">No rentable SKU is configured for this component.</p>}
    </div>}
    {enabled && rule.pricingBehavior !== 'INCLUDED' && <p className="mt-3 text-xs font-medium">Additional charge: {formatMinorMoney(rule.priceAdjustment)}</p>}
  </div>;
}

export function BundleConfigurator({ rules, selections, onChange }: { rules: CompositionRule[]; selections: BundleSelection[]; onChange: (selections: BundleSelection[]) => void }) {
  if (!rules.length) return null;
  const update = (ruleId: string, selection?: BundleSelection) => onChange(selection
    ? [...selections.filter((item) => item.compositionRuleId !== ruleId), selection]
    : selections.filter((item) => item.compositionRuleId !== ruleId));
  return <div className="space-y-3"><div><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/60"><Layers3 className="h-4 w-4" />Package components</h3><p className="mt-1 text-xs text-muted-foreground">Every selected component is checked for the same rental dates.</p></div>{rules.map((rule) => <RuleSelector key={rule.id} rule={rule} value={selections.find((selection) => selection.compositionRuleId === rule.id)} onChange={(selection) => update(rule.id, selection)} />)}</div>;
}
