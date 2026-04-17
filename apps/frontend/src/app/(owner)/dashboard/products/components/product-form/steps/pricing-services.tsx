'use client';

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  DollarSign,
  Package,
  BarChart3,
  Layers,
  Shield,
  Sparkles,
  Clock,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import type { ProductFormValues } from '../schema';

/* ─── Rate Plan Templates ──────────────────────────────────────────────── */
const RATE_PLAN_TEMPLATES = [
  {
    type: 'FLAT_PERIOD' as const,
    label: 'Package',
    description: 'Fixed price for a set number of days',
    icon: Package,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    activeColor: 'bg-blue-500 text-white',
    popular: true,
  },
  {
    type: 'PER_DAY' as const,
    label: 'Per Day',
    description: 'Price calculated per rental day',
    icon: CalendarDays,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    activeColor: 'bg-emerald-500 text-white',
    popular: false,
  },
  {
    type: 'TIERED_DAILY' as const,
    label: 'Tiered',
    description: 'Rates decrease with longer rentals',
    icon: BarChart3,
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    activeColor: 'bg-purple-500 text-white',
    popular: false,
  },
  {
    type: 'WEEKLY_MONTHLY' as const,
    label: 'Weekly / Monthly',
    description: 'Bundled pricing for longer periods',
    icon: Layers,
    color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    activeColor: 'bg-amber-500 text-white',
    popular: false,
  },
  {
    type: 'PERCENT_RETAIL' as const,
    label: '% of Retail',
    description: 'Percentage of the item\'s retail value',
    icon: DollarSign,
    color: 'bg-rose-500/10 text-rose-600 border-rose-200',
    activeColor: 'bg-rose-500 text-white',
    popular: false,
  },
] as const;

type RatePlanType = typeof RATE_PLAN_TEMPLATES[number]['type'];

/* ─── Helper: format number to price ───────────────────────────────────── */
function fmtPrice(minor: number): string {
  return `৳${minor.toLocaleString()}`;
}

/* ─── Component ────────────────────────────────────────────────────────── */
export function PricingServicesStep() {
  const { setValue, watch, register, formState: { errors } } = useFormContext<ProductFormValues>();
  
  // Watch pricing fields
  const ratePlanType = watch('ratePlanType') as RatePlanType | undefined;
  const ratePlanConfig = watch('ratePlanConfig') as Record<string, unknown> | undefined;
  const components = (watch('pricingComponents') || []) as Array<{ type: string; config: Record<string, unknown> }>;
  const lateFeeEnabled = watch('lateFeeEnabled') as boolean | undefined;

  // ── Simulator state
  const [simDays, setSimDays] = useState(3);
  const [simResult, setSimResult] = useState<{ base: number; total: number; lines: string[] } | null>(null);

  // ── Compute simulation on changes
  useEffect(() => {
    if (!ratePlanType || !ratePlanConfig) {
      setSimResult(null);
      return;
    }
    const result = simulateLocally(ratePlanType, ratePlanConfig, simDays, components);
    setSimResult(result);
  }, [ratePlanType, ratePlanConfig, simDays, components]);

  // ── Handlers
  const selectRatePlan = (type: RatePlanType) => {
    setValue('ratePlanType', type, { shouldDirty: true });
    
    // Set default configs per type
    switch (type) {
      case 'FLAT_PERIOD':
        setValue('ratePlanConfig', { flatPriceMinor: 0, includedDays: 3, extraDayPriceMinor: 0 });
        break;
      case 'PER_DAY':
        setValue('ratePlanConfig', { unitPriceMinor: 0, minDays: 1 });
        break;
      case 'TIERED_DAILY':
        setValue('ratePlanConfig', { tiers: [{ fromDay: 1, toDay: 3, pricePerDayMinor: 0 }, { fromDay: 4, toDay: null, pricePerDayMinor: 0 }] });
        break;
      case 'WEEKLY_MONTHLY':
        setValue('ratePlanConfig', { dailyPriceMinor: 0, weeklyPriceMinor: 0, monthlyPriceMinor: 0, optimizeCost: true });
        break;
      case 'PERCENT_RETAIL':
        setValue('ratePlanConfig', { percent: 10, basis: 'PER_RENTAL', minPriceMinor: 0, maxPriceMinor: 0 });
        break;
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setValue('ratePlanConfig', { ...(ratePlanConfig || {}), [key]: value }, { shouldDirty: true });
  };

  const toggleComponent = (type: string, enabled: boolean) => {
    const current = components || [];
    if (enabled) {
      setValue('pricingComponents', [
        ...current,
        { type, config: { label: getDefaultLabel(type), pricing: { mode: 'FLAT', amountMinor: 0 } } },
      ], { shouldDirty: true });
    } else {
      setValue('pricingComponents', current.filter((c: any) => c.type !== type), { shouldDirty: true });
    }
  };

  const updateComponentAmount = (type: string, amount: number) => {
    const current = (components || []).map((c: any) =>
      c.type === type
        ? { ...c, config: { ...c.config, pricing: { mode: 'FLAT', amountMinor: amount } } }
        : c
    );
    setValue('pricingComponents', current, { shouldDirty: true });
  };

  const hasComponent = (type: string) => (components || []).some((c: any) => c.type === type);
  const getComponentAmount = (type: string) => {
    const comp = (components || []).find((c: any) => c.type === type) as any;
    return comp?.config?.pricing?.amountMinor ?? 0;
  };

  return (
    <div className="space-y-8">
      {/* ── Section 1: Rate Plan Type Selector ─────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Pricing Model</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how the rental price is calculated for this product
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {RATE_PLAN_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const isSelected = ratePlanType === template.type;
            return (
              <button
                key={template.type}
                type="button"
                onClick={() => selectRatePlan(template.type)}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/40',
                )}
              >
                {template.popular && (
                  <Badge variant="secondary" className="absolute -top-2.5 right-3 text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                    <Sparkles className="h-3 w-3 mr-0.5" /> Popular
                  </Badge>
                )}
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  isSelected ? template.activeColor : template.color,
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{template.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        {(errors as any).ratePlanType && (
          <p className="text-sm text-destructive mt-2">{(errors as any).ratePlanType?.message || 'Please select a pricing model'}</p>
        )}
      </div>

      {/* ── Section 2: Rate Plan Config ────────────────────────────────── */}
      {ratePlanType && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Rate Plan Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Configure the details for your selected pricing model
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ratePlanType === 'PER_DAY' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Price per Day</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      placeholder="e.g. 500"
                      value={(ratePlanConfig as any)?.unitPriceMinor || ''}
                      onChange={(e) => updateConfig('unitPriceMinor', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Minimum Days</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1"
                    value={(ratePlanConfig as any)?.minDays || ''}
                    onChange={(e) => updateConfig('minDays', Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {ratePlanType === 'FLAT_PERIOD' && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Package Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      placeholder="e.g. 2500"
                      value={(ratePlanConfig as any)?.flatPriceMinor || ''}
                      onChange={(e) => updateConfig('flatPriceMinor', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Included Days</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="3"
                    value={(ratePlanConfig as any)?.includedDays || ''}
                    onChange={(e) => updateConfig('includedDays', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Extra Day Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      placeholder="e.g. 300"
                      value={(ratePlanConfig as any)?.extraDayPriceMinor || ''}
                      onChange={(e) => updateConfig('extraDayPriceMinor', Number(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Per day beyond included days</p>
                </div>
              </div>
            )}

            {ratePlanType === 'TIERED_DAILY' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">Add pricing tiers — longer rentals get lower daily rates</p>
                </div>
                {((ratePlanConfig as any)?.tiers || []).map((tier: any, i: number) => (
                  <div key={i} className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">From Day</Label>
                      <Input
                        type="number"
                        min={1}
                        value={tier.fromDay || ''}
                        onChange={(e) => {
                          const tiers = [...((ratePlanConfig as any)?.tiers || [])];
                          tiers[i] = { ...tiers[i], fromDay: Number(e.target.value) };
                          updateConfig('tiers', tiers);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">To Day</Label>
                      <Input
                        type="number"
                        placeholder="∞"
                        value={tier.toDay ?? ''}
                        onChange={(e) => {
                          const tiers = [...((ratePlanConfig as any)?.tiers || [])];
                          tiers[i] = { ...tiers[i], toDay: e.target.value ? Number(e.target.value) : null };
                          updateConfig('tiers', tiers);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">৳/Day</Label>
                      <Input
                        type="number"
                        value={tier.pricePerDayMinor || ''}
                        onChange={(e) => {
                          const tiers = [...((ratePlanConfig as any)?.tiers || [])];
                          tiers[i] = { ...tiers[i], pricePerDayMinor: Number(e.target.value) };
                          updateConfig('tiers', tiers);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const tiers = [...((ratePlanConfig as any)?.tiers || [])];
                    const lastEnd = tiers.length ? (tiers[tiers.length - 1].toDay ?? 99) + 1 : 1;
                    tiers.push({ fromDay: lastEnd, toDay: null, pricePerDayMinor: 0 });
                    updateConfig('tiers', tiers);
                  }}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  + Add Tier
                </button>
              </div>
            )}

            {ratePlanType === 'WEEKLY_MONTHLY' && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Daily Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={(ratePlanConfig as any)?.dailyPriceMinor || ''}
                      onChange={(e) => updateConfig('dailyPriceMinor', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Weekly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={(ratePlanConfig as any)?.weeklyPriceMinor || ''}
                      onChange={(e) => updateConfig('weeklyPriceMinor', Number(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">7-day bundle price</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Monthly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={(ratePlanConfig as any)?.monthlyPriceMinor || ''}
                      onChange={(e) => updateConfig('monthlyPriceMinor', Number(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">30-day bundle price</p>
                </div>
              </div>
            )}

            {ratePlanType === 'PERCENT_RETAIL' && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Rental %</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={(ratePlanConfig as any)?.percent || ''}
                      onChange={(e) => updateConfig('percent', Number(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">% of product's purchase/retail price</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      placeholder="Optional"
                      value={(ratePlanConfig as any)?.minPriceMinor || ''}
                      onChange={(e) => updateConfig('minPriceMinor', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      className="pl-7"
                      placeholder="Optional"
                      value={(ratePlanConfig as any)?.maxPriceMinor || ''}
                      onChange={(e) => updateConfig('maxPriceMinor', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Section 3: Fees & Deposits (Components) ────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Fees & Deposits</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Optional charges added to the rental price
        </p>

        <div className="grid gap-3">
          {/* Security Deposit */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Security Deposit</p>
                <p className="text-xs text-muted-foreground">Refundable upon safe return</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasComponent('DEPOSIT') && (
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    className="pl-6 h-9 text-sm"
                    value={getComponentAmount('DEPOSIT') || ''}
                    onChange={(e) => updateComponentAmount('DEPOSIT', Number(e.target.value))}
                  />
                </div>
              )}
              <Switch
                checked={hasComponent('DEPOSIT')}
                onCheckedChange={(v) => toggleComponent('DEPOSIT', v)}
              />
            </div>
          </div>

          {/* Cleaning Fee */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Cleaning Fee</p>
                <p className="text-xs text-muted-foreground">Non-refundable service charge</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasComponent('FEE') && (
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    className="pl-6 h-9 text-sm"
                    value={getComponentAmount('FEE') || ''}
                    onChange={(e) => updateComponentAmount('FEE', Number(e.target.value))}
                  />
                </div>
              )}
              <Switch
                checked={hasComponent('FEE')}
                onCheckedChange={(v) => toggleComponent('FEE', v)}
              />
            </div>
          </div>

          {/* Backup Size */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Backup Size</p>
                <p className="text-xs text-muted-foreground">Customer add-on for safety net</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasComponent('ADDON_BACKUP') && (
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    className="pl-6 h-9 text-sm"
                    value={getComponentAmount('ADDON_BACKUP') || ''}
                    onChange={(e) => updateComponentAmount('ADDON_BACKUP', Number(e.target.value))}
                  />
                </div>
              )}
              <Switch
                checked={hasComponent('ADDON_BACKUP')}
                onCheckedChange={(v) => toggleComponent('ADDON_BACKUP', v)}
              />
            </div>
          </div>

          {/* Try-On */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Try-On Service</p>
                <p className="text-xs text-muted-foreground">Customer add-on for trial</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasComponent('ADDON_TRYON') && (
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    className="pl-6 h-9 text-sm"
                    value={getComponentAmount('ADDON_TRYON') || ''}
                    onChange={(e) => updateComponentAmount('ADDON_TRYON', Number(e.target.value))}
                  />
                </div>
              )}
              <Switch
                checked={hasComponent('ADDON_TRYON')}
                onCheckedChange={(v) => toggleComponent('ADDON_TRYON', v)}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Section 4: Late Fee Policy ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Late Fee Policy</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          What happens if the customer returns late
        </p>

        <div className="flex items-center justify-between p-4 rounded-xl border bg-card mb-3">
          <div>
            <p className="font-medium text-sm">Enable Late Fees</p>
            <p className="text-xs text-muted-foreground">Charge customers for overdue returns</p>
          </div>
          <Switch
            checked={!!lateFeeEnabled}
            onCheckedChange={(v) => setValue('lateFeeEnabled', v, { shouldDirty: true })}
          />
        </div>

        {lateFeeEnabled && (
          <div className="grid sm:grid-cols-3 gap-4 p-4 rounded-lg border bg-muted/20">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Grace Period</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  placeholder="24"
                  value={watch('lateFeeGraceHours') || ''}
                  onChange={(e) => setValue('lateFeeGraceHours', Number(e.target.value), { shouldDirty: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">hours</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fee per Day</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="100"
                  value={watch('lateFeeAmountMinor') || ''}
                  onChange={(e) => setValue('lateFeeAmountMinor', Number(e.target.value), { shouldDirty: true })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Max Fee Cap</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="Optional"
                  value={watch('lateFeeCapMinor') || ''}
                  onChange={(e) => setValue('lateFeeCapMinor', Number(e.target.value), { shouldDirty: true })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Section 5: Preview Simulator ───────────────────────────────── */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Price Preview
          </CardTitle>
          <CardDescription className="text-xs">
            See what the customer would pay for a test rental
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Label className="text-sm font-medium whitespace-nowrap">Rental Days:</Label>
            <Input
              type="number"
              min={1}
              max={90}
              className="w-24"
              value={simDays}
              onChange={(e) => setSimDays(Math.max(1, Number(e.target.value)))}
            />
            <div className="flex gap-1">
              {[1, 3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSimDays(d)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border transition-colors',
                    simDays === d
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 hover:bg-muted border-border',
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {simResult ? (
            <div className="space-y-2 p-4 rounded-lg bg-background border">
              {simResult.lines.map((line, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{line.split(':')[0]}</span>
                  <span className="font-medium">{line.split(':')[1]}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>Total Due</span>
                <span className="text-primary">{fmtPrice(simResult.total)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
              Select a pricing model above to see a preview
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Local Simulator (client-side estimate) ───────────────────────────── */
function getDefaultLabel(type: string): string {
  switch (type) {
    case 'DEPOSIT': return 'Security Deposit';
    case 'FEE': return 'Cleaning Fee';
    case 'ADDON_BACKUP': return 'Backup Size';
    case 'ADDON_TRYON': return 'Try-On Service';
    default: return type;
  }
}

function simulateLocally(
  planType: RatePlanType,
  config: Record<string, unknown>,
  days: number,
  components?: Array<Record<string, unknown>>,
): { base: number; total: number; lines: string[] } | null {
  let base = 0;
  const lines: string[] = [];

  switch (planType) {
    case 'PER_DAY': {
      const rate = Number(config.unitPriceMinor || 0);
      const minDays = Number(config.minDays || 1);
      const effectiveDays = Math.max(days, minDays);
      base = rate * effectiveDays;
      lines.push(`Base Rental (${effectiveDays}d × ৳${rate}): ${fmtPrice(base)}`);
      break;
    }
    case 'FLAT_PERIOD': {
      const flat = Number(config.flatPriceMinor || 0);
      const included = Number(config.includedDays || 1);
      const extra = Number(config.extraDayPriceMinor || 0);
      if (days <= included) {
        base = flat;
        lines.push(`Package (${included}d): ${fmtPrice(flat)}`);
      } else {
        const extraDays = days - included;
        const extraCost = extraDays * extra;
        base = flat + extraCost;
        lines.push(`Package (${included}d): ${fmtPrice(flat)}`);
        lines.push(`Extra Days (${extraDays}d × ৳${extra}): ${fmtPrice(extraCost)}`);
      }
      break;
    }
    case 'TIERED_DAILY': {
      const tiers = (config.tiers as any[]) || [];
      let remaining = days;
      for (const tier of tiers) {
        if (remaining <= 0) break;
        const tierEnd = tier.toDay ?? Infinity;
        const tierDays = Math.min(remaining, tierEnd - tier.fromDay + 1);
        const cost = tierDays * Number(tier.pricePerDayMinor || 0);
        base += cost;
        lines.push(`Days ${tier.fromDay}-${tier.toDay || '∞'} (${tierDays}d × ৳${tier.pricePerDayMinor}): ${fmtPrice(cost)}`);
        remaining -= tierDays;
      }
      break;
    }
    case 'WEEKLY_MONTHLY': {
      const daily = Number(config.dailyPriceMinor || 0);
      base = daily * days;
      lines.push(`${days}d × ৳${daily}/day: ${fmtPrice(base)}`);
      break;
    }
    case 'PERCENT_RETAIL': {
      const pct = Number(config.percent || 0);
      lines.push(`${pct}% of retail: (needs retail price)`);
      base = 0;
      break;
    }
    default:
      return null;
  }

  let total = base;

  // Add components
  if (components?.length) {
    for (const comp of components) {
      const amount = Number((comp.config as any)?.pricing?.amountMinor || 0);
      if (amount > 0) {
        const label = (comp.config as any)?.label || comp.type;
        lines.push(`${label}: ${fmtPrice(amount)}`);
        if (comp.type !== 'DEPOSIT') {
          total += amount;
        }
      }
    }
  }

  return { base, total, lines };
}
