'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Boxes, Loader2, PackagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  fulfillmentApi,
  type CompositionRole,
  type CompositionRule,
  type CompositionRuleInput,
  type PricingBehavior,
  type SkuResolution,
  type SubstitutionPolicy,
} from '@/lib/api/fulfillment';
import { productApi, type ProductDetail, type ProductListItem } from '@/lib/api/products';

function apiError(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function RuleDialog({ productId, products, existing, onSaved }: { productId: string; products: ProductListItem[]; existing?: CompositionRule; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<CompositionRole>(existing?.role || 'REQUIRED_COMPONENT');
  const [name, setName] = useState(existing?.name || '');
  const [componentProductId, setComponentProductId] = useState(existing?.componentProductId || '');
  const [resolution, setResolution] = useState<SkuResolution>(existing?.skuResolution || 'FIXED');
  const [fixedVariantSizeId, setFixedVariantSizeId] = useState(existing?.fixedVariantSizeId || '');
  const [quantity, setQuantity] = useState(existing?.quantity || 1);
  const [substitutionPolicy, setSubstitutionPolicy] = useState<SubstitutionPolicy>(existing?.substitutionPolicy || 'NOT_ALLOWED');
  const [pricingBehavior, setPricingBehavior] = useState<PricingBehavior>(existing?.pricingBehavior || 'INCLUDED');
  const [priceAdjustment, setPriceAdjustment] = useState(existing?.priceAdjustment || 0);
  const [customerApproval, setCustomerApproval] = useState(existing?.customerApprovalRequired || false);
  const [defaultSelected, setDefaultSelected] = useState(existing?.isDefaultSelected || false);
  const [compatibilityNotes, setCompatibilityNotes] = useState((existing?.compatibilityRules as { notes?: string } | undefined)?.notes || '');
  const [alternativeProductIds, setAlternativeProductIds] = useState<string[]>(existing?.alternatives.map((item) => item.productId) || []);
  const componentQuery = useQuery({
    queryKey: ['product-detail-for-composition', componentProductId],
    queryFn: () => productApi.getById(componentProductId),
    enabled: open && !!componentProductId,
  });
  const skus = useMemo(() => componentQuery.data?.variants.flatMap((variant) => variant.sizes.map((size) => ({ id: size.id, label: `${variant.variantName || variant.mainColor.name} · ${size.sizeInstance.displayLabel}` }))) || [], [componentQuery.data]);

  useEffect(() => {
    if (resolution !== 'FIXED') setFixedVariantSizeId('');
  }, [resolution]);

  const save = useMutation({
    mutationFn: () => {
      const payload: CompositionRuleInput = {
        role,
        name,
        componentProductId,
        fixedVariantSizeId: resolution === 'FIXED' ? fixedVariantSizeId : undefined,
        quantity,
        skuResolution: resolution,
        substitutionPolicy,
        pricingBehavior,
        priceAdjustment,
        allocationWeight: 1,
        isDefaultSelected: defaultSelected,
        customerApprovalRequired: customerApproval || substitutionPolicy === 'CUSTOMER_APPROVAL',
        compatibilityRules: compatibilityNotes.trim() ? { notes: compatibilityNotes.trim() } : undefined,
        alternatives: alternativeProductIds.map((alternativeProductId, index) => ({ productId: alternativeProductId, priority: index })),
      };
      return existing ? fulfillmentApi.updateComposition(existing.id, payload) : fulfillmentApi.createComposition(productId, payload);
    },
    onSuccess: async () => { setOpen(false); await onSaved(); toast.success(existing ? 'Composition rule updated' : 'Composition rule created'); },
    onError: (error) => toast.error(apiError(error, 'Could not save composition rule')),
  });
  const valid = name.trim() && componentProductId && (resolution !== 'FIXED' || fixedVariantSizeId);
  const availableAlternatives = products.filter((product) => product.id !== productId && product.id !== componentProductId && !alternativeProductIds.includes(product.id));

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{existing ? <Button size="sm" variant="outline">Edit</Button> : <Button><PackagePlus className="mr-2 h-4 w-4" />Add bundle component</Button>}</DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{existing ? 'Edit' : 'Add'} bundle component</DialogTitle><DialogDescription>Use this only when the component has its own inventory identity. Inseparable garment pieces belong in the SKU set checklist.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Role</Label><Select value={role} onValueChange={(value) => setRole(value as CompositionRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="REQUIRED_COMPONENT">Required component</SelectItem><SelectItem value="OPTIONAL_ADDON">Optional add-on</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Display name</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Shoes, jewelry, dupatta…" /></div></div>
        <div className="grid gap-2"><Label>Component product</Label><Select value={componentProductId} onValueChange={(value) => { setComponentProductId(value); setFixedVariantSizeId(''); }}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.filter((product) => product.id !== productId).map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>SKU resolution</Label><Select value={resolution} onValueChange={(value) => setResolution(value as SkuResolution)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIXED">Fixed SKU</SelectItem><SelectItem value="CUSTOMER_SELECTED">Customer selects</SelectItem><SelectItem value="PARENT_DERIVED">Match parent size</SelectItem><SelectItem value="STAFF_SELECTED">Staff selects</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Quantity per parent</Label><Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></div></div>
        {resolution === 'FIXED' && <div className="grid gap-2"><Label>Fixed SKU</Label><Select value={fixedVariantSizeId} onValueChange={setFixedVariantSizeId} disabled={componentQuery.isLoading}><SelectTrigger><SelectValue placeholder={componentQuery.isLoading ? 'Loading SKUs…' : 'Select color / size'} /></SelectTrigger><SelectContent>{skus.map((sku) => <SelectItem key={sku.id} value={sku.id}>{sku.label}</SelectItem>)}</SelectContent></Select></div>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Substitution policy</Label><Select value={substitutionPolicy} onValueChange={(value) => setSubstitutionPolicy(value as SubstitutionPolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['NOT_ALLOWED', 'EQUIVALENT_ONLY', 'STAFF_APPROVAL', 'CUSTOMER_APPROVAL'] as SubstitutionPolicy[]).map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Pricing</Label><Select value={pricingBehavior} onValueChange={(value) => setPricingBehavior(value as PricingBehavior)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCLUDED">Included</SelectItem><SelectItem value="ADDITIVE">Added to package</SelectItem><SelectItem value="OPTIONAL_PRICE">Optional price</SelectItem></SelectContent></Select></div></div>
        {pricingBehavior !== 'INCLUDED' && <div className="grid gap-2"><Label>Price adjustment (৳)</Label><Input type="number" value={priceAdjustment} onChange={(event) => setPriceAdjustment(Number(event.target.value) || 0)} /></div>}
        <div className="grid gap-2"><Label>Compatibility guidance</Label><Textarea value={compatibilityNotes} onChange={(event) => setCompatibilityNotes(event.target.value)} placeholder="Matching color, size, style, or material guidance" /></div>
        <div className="space-y-3 rounded-md border p-3"><div className="flex items-center justify-between"><div><Label>Allowed alternative products</Label><p className="text-xs text-muted-foreground">Used for selection and controlled substitutions.</p></div>{availableAlternatives.length > 0 && <Select onValueChange={(value) => setAlternativeProductIds((current) => [...current, value])}><SelectTrigger className="w-44"><SelectValue placeholder="Add alternative" /></SelectTrigger><SelectContent>{availableAlternatives.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select>}</div>{alternativeProductIds.map((alternativeId) => <div key={alternativeId} className="flex items-center justify-between rounded border p-2 text-sm"><span>{products.find((product) => product.id === alternativeId)?.name || alternativeId}</span><Button size="icon" variant="ghost" onClick={() => setAlternativeProductIds((current) => current.filter((id) => id !== alternativeId))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
        <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><Checkbox checked={defaultSelected} onCheckedChange={(checked) => setDefaultSelected(checked === true)} />Selected by default</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={customerApproval} onCheckedChange={(checked) => setCustomerApproval(checked === true)} />Customer approval for substitution</label></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save rule</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export default function ProductCompositionPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const productQuery = useQuery({ queryKey: ['product', id], queryFn: () => productApi.getById(id), enabled: !!id });
  const productsQuery = useQuery({ queryKey: ['products-for-composition'], queryFn: () => productApi.list({ limit: 100, sort: 'name', order: 'asc' }) });
  const rulesQuery = useQuery({ queryKey: ['product-composition', id], queryFn: () => fulfillmentApi.listComposition(id), enabled: !!id });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['product-composition', id] }); };
  const deactivate = useMutation({ mutationFn: fulfillmentApi.deactivateComposition, onSuccess: async () => { await refresh(); toast.success('Composition rule deactivated'); }, onError: (error) => toast.error(apiError(error, 'Could not deactivate rule')) });
  const product = productQuery.data as ProductDetail | undefined;
  const products = productsQuery.data?.data || [];

  if (productQuery.isLoading || rulesQuery.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return <div className="space-y-6 pb-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><Button variant="ghost" size="sm" className="-ml-3" asChild><Link href={`/dashboard/products/${id}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to product</Link></Button><h1 className="text-2xl font-semibold">Bundle composition · {product?.name}</h1><p className="text-sm text-muted-foreground">Build assembled packages from independently reservable products. Use Inventory → Set checklist for inseparable pieces.</p></div><RuleDialog productId={id} products={products} onSaved={refresh} /></div>
    {!rulesQuery.data?.length ? <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><Boxes className="h-9 w-9 text-muted-foreground" /><div><p className="font-medium">This is a single-product rental</p><p className="text-sm text-muted-foreground">Add a rule when renting this product should reserve another independently managed item.</p></div></CardContent></Card> : <div className="space-y-3">{rulesQuery.data.map((rule) => <Card key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{rule.name}</CardTitle><CardDescription>{rule.componentProduct?.name} · {label(rule.role)} · {rule.quantity} per parent</CardDescription></div><div className="flex gap-2"><Badge variant={rule.isActive ? 'default' : 'secondary'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge><Badge variant="outline">{label(rule.skuResolution)}</Badge></div></div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-1 text-sm"><p>{rule.fixedVariantSize ? `${rule.fixedVariantSize.variant.variantName || rule.fixedVariantSize.variant.mainColor.name} · ${rule.fixedVariantSize.sizeInstance.displayLabel}` : 'SKU resolved during selection'}</p><p className="text-muted-foreground">{label(rule.pricingBehavior)} · {label(rule.substitutionPolicy)} · {rule.alternatives.length} alternative(s) · version {rule.configurationVersion}</p></div>{rule.isActive && <div className="flex gap-2"><RuleDialog productId={id} products={products} existing={rule} onSaved={refresh} /><Button size="sm" variant="ghost" disabled={deactivate.isPending} onClick={() => deactivate.mutate(rule.id)}>Deactivate</Button></div>}</CardContent></Card>)}</div>}
  </div>;
}
