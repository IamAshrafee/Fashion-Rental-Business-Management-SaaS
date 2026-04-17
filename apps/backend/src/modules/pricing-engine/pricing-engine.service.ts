/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';
import type {
  PerDayConfig,
  FlatPeriodConfig,
  TieredDailyConfig,
  WeeklyMonthlyConfig,
  PercentRetailConfig,
  ComponentPricingConfig,
  LateFeePolicy,
  ConditionDef,
  QuoteLineItem as QuoteLineItemType,
} from '@closetrent/types';

// ============================================================================
// Internal types for the engine
// ============================================================================

interface QuoteInput {
  tenantId: string;
  productId: string;
  variantId?: string;
  startAt: Date;
  endAt: Date;
  context?: {
    customerTier?: string;
    channel?: string;
    location?: string;
  };
  selectedAddons?: string[];
  retailPriceMinor?: number; // from product.purchasePrice
}

interface ComputedLineItem {
  type: string;
  label: string;
  amountMinor: number;
  refundable: boolean;
  visibility: 'CUSTOMER' | 'STAFF_ONLY';
  chargeTiming: string;
  metadata?: Record<string, unknown>;
}

interface QuoteResult {
  policyVersionId: string;
  currency: string;
  billableDays: number;
  lineItems: ComputedLineItem[];
  subtotalMinor: number;
  depositMinor: number;
  totalDueNowMinor: number;
  totalDueLaterMinor: number;
}

/**
 * Deterministic Pricing Engine.
 *
 * Given a product + date range + context, computes an itemized quote
 * by evaluating the active PricePolicyVersion's rate plans and components.
 *
 * All money values are integers in minor units (e.g., paisa for BDT).
 */
@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // PUBLIC: Compute Quote
  // =========================================================================

  /**
   * Main entry point. Loads the active policy version for a product
   * and computes a deterministic, itemized quote.
   */
  async computeQuote(input: QuoteInput): Promise<QuoteResult> {
    // 1. Load pricing profile + active policy version
    const profile = await this.prisma.pricingProfile.findUnique({
      where: { productId: input.productId },
      include: {
        policyVersions: {
          where: { status: 'ACTIVE' },
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            ratePlans: {
              orderBy: { priority: 'desc' },
              include: {
                conditionSet: { include: { conditions: true } },
              },
            },
            priceComponents: {
              orderBy: { priority: 'desc' },
              include: {
                conditionSet: { include: { conditions: true } },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `No pricing profile found for product ${input.productId}`,
      );
    }

    const policyVersion = profile.policyVersions[0];
    if (!policyVersion) {
      throw new NotFoundException(
        `No active pricing policy version for product ${input.productId}`,
      );
    }

    // 2. Compute billable days
    const billableDays = this.computeBillableDays(
      input.startAt,
      input.endAt,
      profile.durationMode as 'CALENDAR_DAYS' | 'NIGHTS',
      profile.billingRounding as 'CEIL' | 'FLOOR' | 'NEAREST',
    );

    // 3. Select applicable rate plan (highest priority among condition matches)
    const applicableRatePlan = this.selectRatePlan(
      policyVersion.ratePlans,
      input,
      billableDays,
    );

    if (!applicableRatePlan) {
      throw new NotFoundException('No applicable rate plan found for the given inputs');
    }

    // 4. Compute base rental line item
    const baseLineItem = this.computeBaseRental(
      applicableRatePlan.type as any,
      applicableRatePlan.config as any,
      billableDays,
      input.retailPriceMinor,
    );

    const lineItems: ComputedLineItem[] = [baseLineItem];

    // 5. Apply applicable price components
    const baseAmount = baseLineItem.amountMinor;

    for (const component of policyVersion.priceComponents) {
      // Check conditions
      if (!this.evaluateConditions(component.conditionSet, input, billableDays)) {
        continue;
      }

      // Check if it's an addon and whether it's selected
      if (component.type === 'ADDON') {
        const addonId = (component.config as any)?.addonId || component.id;
        if (!input.selectedAddons?.includes(addonId)) {
          continue;
        }
      }

      const lineItem = this.computeComponentLineItem(
        component,
        baseAmount,
        input.retailPriceMinor,
        billableDays,
      );

      if (lineItem) {
        lineItems.push(lineItem);
      }
    }

    // 6. Compute totals
    const subtotalMinor = lineItems
      .filter((li) => li.type !== 'DEPOSIT' && li.visibility === 'CUSTOMER')
      .reduce((sum, li) => sum + li.amountMinor, 0);

    const depositMinor = lineItems
      .filter((li) => li.type === 'DEPOSIT')
      .reduce((sum, li) => sum + li.amountMinor, 0);

    const totalDueNowMinor = lineItems
      .filter((li) => li.chargeTiming === 'AT_BOOKING' && li.visibility === 'CUSTOMER')
      .reduce((sum, li) => sum + li.amountMinor, 0);

    const totalDueLaterMinor = lineItems
      .filter(
        (li) =>
          li.chargeTiming !== 'AT_BOOKING' &&
          li.visibility === 'CUSTOMER',
      )
      .reduce((sum, li) => sum + li.amountMinor, 0);

    return {
      policyVersionId: policyVersion.id,
      currency: profile.currency,
      billableDays,
      lineItems,
      subtotalMinor,
      depositMinor,
      totalDueNowMinor,
      totalDueLaterMinor,
    };
  }

  /**
   * Legacy compatibility: compute pricing for the booking service
   * using the old PricingSnapshot interface shape.
   */
  async computeLegacyPricing(
    productId: string,
    startDate: string,
    endDate: string,
    options?: { backupSize?: string; tryOn?: boolean },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { purchasePrice: true, tenantId: true },
    });

    try {
      const result = await this.computeQuote({
        tenantId: product?.tenantId || '',
        productId,
        startAt: new Date(startDate),
        endAt: new Date(endDate),
        retailPriceMinor: product?.purchasePrice ?? undefined,
        selectedAddons: [
          ...(options?.backupSize ? ['BACKUP_SIZE'] : []),
          ...(options?.tryOn ? ['TRY_ON'] : []),
        ],
      });

      // Map to legacy shape
      const baseRentalItem = result.lineItems.find((li) => li.type === 'BASE_RENTAL');
      const cleaningItem = result.lineItems.find((li) => li.type === 'CLEANING_FEE' || li.type === 'FEE');
      const depositItem = result.lineItems.find((li) => li.type === 'DEPOSIT');
      const backupItem = result.lineItems.find((li) => li.type === 'BACKUP_SIZE');
      const tryOnItem = result.lineItems.find((li) => li.type === 'TRY_ON');

      return {
        rentalDays: result.billableDays,
        baseRental: baseRentalItem?.amountMinor ?? 0,
        extendedDays: 0, // handled within base rental now
        extendedCost: 0,
        depositAmount: depositItem?.amountMinor ?? 0,
        cleaningFee: cleaningItem?.amountMinor ?? 0,
        backupSizeFee: backupItem?.amountMinor ?? 0,
        tryOnFee: tryOnItem?.amountMinor ?? 0,
        shippingFee: 0,
        itemTotal: result.subtotalMinor,
        policyVersionId: result.policyVersionId,
      };
    } catch {
      // If no pricing profile exists (legacy product), return null
      // so the caller can fall back to the old calculatePricingForDates
      return null;
    }
  }

  // =========================================================================
  // DURATION CALCULATION
  // =========================================================================

  computeBillableDays(
    startAt: Date,
    endAt: Date,
    mode: 'CALENDAR_DAYS' | 'NIGHTS',
    rounding: 'CEIL' | 'FLOOR' | 'NEAREST',
  ): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = endAt.getTime() - startAt.getTime();

    if (mode === 'NIGHTS') {
      // Count nights: just floor the day difference
      return Math.max(1, Math.floor(diffMs / msPerDay));
    }

    // CALENDAR_DAYS: count the days in the range (inclusive)
    const rawDays = diffMs / msPerDay;
    let days: number;

    switch (rounding) {
      case 'CEIL':
        days = Math.ceil(rawDays);
        break;
      case 'FLOOR':
        days = Math.floor(rawDays);
        break;
      case 'NEAREST':
        days = Math.round(rawDays);
        break;
      default:
        days = Math.ceil(rawDays);
    }

    // +1 because calendar days are inclusive (Apr 20 to Apr 22 = 3 days)
    // But only when using Date-only (no time). When using timestamps,
    // the diff already accounts for it properly.
    // For safety, ensure minimum of 1
    return Math.max(1, days === 0 ? 1 : days);
  }

  // =========================================================================
  // RATE PLAN SELECTION
  // =========================================================================

  private selectRatePlan(
    ratePlans: Array<{
      id: string;
      type: string;
      priority: number;
      config: any;
      conditionSet: { conditions: Array<{ field: string; operator: string; value: any }> } | null;
    }>,
    input: QuoteInput,
    billableDays: number,
  ) {
    // Filter to only rate plans whose conditions match
    const matching = ratePlans.filter((rp) =>
      this.evaluateConditions(rp.conditionSet, input, billableDays),
    );

    if (matching.length === 0) return null;

    // Sort by priority DESC, then by condition specificity DESC, then by id ASC (stable tiebreaker)
    matching.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aSpecificity = a.conditionSet?.conditions?.length ?? 0;
      const bSpecificity = b.conditionSet?.conditions?.length ?? 0;
      if (aSpecificity !== bSpecificity) return bSpecificity - aSpecificity;
      return a.id.localeCompare(b.id);
    });

    return matching[0];
  }

  // =========================================================================
  // CONDITION EVALUATION (Pure, deterministic)
  // =========================================================================

  private evaluateConditions(
    conditionSet: { conditions: Array<{ field: string; operator: string; value: any }> } | null,
    input: QuoteInput,
    billableDays: number,
  ): boolean {
    if (!conditionSet || !conditionSet.conditions || conditionSet.conditions.length === 0) {
      return true; // No conditions = always applies
    }

    // ALL conditions in a set must match (AND logic)
    return conditionSet.conditions.every((cond) =>
      this.evaluateSingleCondition(cond, input, billableDays),
    );
  }

  private evaluateSingleCondition(
    cond: { field: string; operator: string; value: any },
    input: QuoteInput,
    billableDays: number,
  ): boolean {
    const { field, operator, value } = cond;

    switch (field) {
      case 'duration_days': {
        return this.compareNumeric(billableDays, operator, value);
      }
      case 'customer_tier': {
        const tier = input.context?.customerTier || 'REGULAR';
        return this.compareString(tier, operator, value);
      }
      case 'channel': {
        const channel = input.context?.channel || 'ONLINE';
        return this.compareString(channel, operator, value);
      }
      case 'location': {
        const location = input.context?.location || '';
        return this.compareString(location, operator, value);
      }
      case 'dow': {
        // Check if any day in the rental range matches specified days of week
        const daysOfWeek = Array.isArray(value) ? value : [value];
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const start = new Date(input.startAt);
        const end = new Date(input.endAt);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (daysOfWeek.includes(dayNames[d.getDay()])) return true;
        }
        return false;
      }
      case 'date_range': {
        // Check if rental period overlaps with condition date range
        if (operator === 'OVERLAPS' && value && value.start && value.end) {
          const condStart = new Date(value.start);
          const condEnd = new Date(value.end);
          return input.startAt <= condEnd && input.endAt >= condStart;
        }
        return true;
      }
      default:
        // Unknown condition fields are ignored (pass by default)
        return true;
    }
  }

  private compareNumeric(actual: number, operator: string, value: any): boolean {
    switch (operator) {
      case 'EQ': return actual === Number(value);
      case 'GTE': return actual >= Number(value);
      case 'LTE': return actual <= Number(value);
      case 'BETWEEN': return actual >= Number(value[0]) && actual <= Number(value[1]);
      case 'IN': return Array.isArray(value) && value.map(Number).includes(actual);
      default: return true;
    }
  }

  private compareString(actual: string, operator: string, value: any): boolean {
    switch (operator) {
      case 'EQ': return actual === String(value);
      case 'IN': return Array.isArray(value) && value.includes(actual);
      default: return true;
    }
  }

  // =========================================================================
  // BASE RENTAL COMPUTATION (per rate plan type)
  // =========================================================================

  private computeBaseRental(
    type: string,
    config: any,
    billableDays: number,
    retailPriceMinor?: number,
  ): ComputedLineItem {
    let amount = 0;
    let label = '';

    switch (type) {
      case 'PER_DAY': {
        const c = config as PerDayConfig;
        const effectiveDays = Math.max(billableDays, c.minDays || 1);
        amount = effectiveDays * c.unitPriceMinor;
        label = `${effectiveDays}-day rental (${c.unitPriceMinor} × ${effectiveDays})`;
        break;
      }
      case 'FLAT_PERIOD': {
        const c = config as FlatPeriodConfig;
        if (billableDays <= c.includedDays) {
          amount = c.flatPriceMinor;
          label = `${c.includedDays}-day rental`;
        } else {
          const extraDays = billableDays - c.includedDays;
          const extraCost = extraDays * (c.extraDayPriceMinor ?? 0);
          amount = c.flatPriceMinor + extraCost;
          label = `${c.includedDays}-day rental + ${extraDays} extra day(s)`;
        }
        break;
      }
      case 'TIERED_DAILY': {
        const c = config as TieredDailyConfig;
        const effectiveDays = Math.max(billableDays, c.minDays || 1);
        let remaining = effectiveDays;
        let total = 0;

        // Sort tiers by fromDay ascending
        const sortedTiers = [...c.tiers].sort((a, b) => a.fromDay - b.fromDay);

        for (const tier of sortedTiers) {
          if (remaining <= 0) break;
          const tierEnd = tier.toDay ?? Infinity;
          const tierStart = tier.fromDay;
          const tierDays = Math.min(remaining, tierEnd - tierStart + 1);
          total += tierDays * tier.pricePerDayMinor;
          remaining -= tierDays;
        }

        amount = total;
        label = `${effectiveDays}-day tiered rental`;
        break;
      }
      case 'WEEKLY_MONTHLY': {
        const c = config as WeeklyMonthlyConfig;
        if (c.optimizeCost) {
          amount = this.optimizeWeeklyMonthly(c, billableDays);
        } else {
          // Simple: use daily rate if available, otherwise weekly/monthly prorating
          amount = (c.dailyPriceMinor ?? 0) * billableDays;
        }
        label = `${billableDays}-day rental`;
        break;
      }
      case 'PERCENT_RETAIL': {
        const c = config as PercentRetailConfig;
        const retail = retailPriceMinor ?? 0;
        let computed = Math.ceil(retail * (c.percent / 100));

        if (c.basis === 'PER_DAY') {
          computed = computed * billableDays;
        }

        if (c.minPriceMinor && computed < c.minPriceMinor) computed = c.minPriceMinor;
        if (c.maxPriceMinor && computed > c.maxPriceMinor) computed = c.maxPriceMinor;

        amount = computed;
        label = `${c.percent}% of retail value rental`;
        break;
      }
      default:
        label = 'Base rental';
    }

    return {
      type: 'BASE_RENTAL',
      label,
      amountMinor: amount,
      refundable: false,
      visibility: 'CUSTOMER',
      chargeTiming: 'AT_BOOKING',
    };
  }

  /**
   * Finds the cheapest combination of monthly, weekly, and daily rates.
   */
  private optimizeWeeklyMonthly(config: WeeklyMonthlyConfig, days: number): number {
    const daily = config.dailyPriceMinor ?? Infinity;
    const weekly = config.weeklyPriceMinor ?? Infinity;
    const monthly = config.monthlyPriceMinor ?? Infinity;

    // Try all combinations and pick the cheapest
    let bestCost = daily * days; // Worst case: all daily

    // Try months + weeks + days
    for (let months = Math.floor(days / 30); months >= 0; months--) {
      const afterMonths = days - months * 30;
      for (let weeks = Math.floor(afterMonths / 7); weeks >= 0; weeks--) {
        const afterWeeks = afterMonths - weeks * 7;
        const cost = months * monthly + weeks * weekly + afterWeeks * daily;
        if (cost < bestCost) bestCost = cost;
      }
    }

    return bestCost;
  }

  // =========================================================================
  // COMPONENT LINE ITEM COMPUTATION
  // =========================================================================

  private computeComponentLineItem(
    component: {
      id: string;
      type: string;
      priority: number;
      visibility: string;
      chargeTiming: string;
      refundable: boolean;
      config: any;
    },
    baseAmount: number,
    retailPriceMinor: number | undefined,
    billableDays: number,
  ): ComputedLineItem | null {
    const config = component.config as ComponentPricingConfig;
    if (!config || !config.pricing) return null;

    let amount = 0;
    const pricing = config.pricing;

    switch (pricing.mode) {
      case 'FLAT':
        amount = pricing.amountMinor;
        break;
      case 'PERCENT_OF_BASE': {
        amount = Math.ceil(baseAmount * (pricing.percent / 100));
        if (pricing.capMinor && amount > pricing.capMinor) {
          amount = pricing.capMinor;
        }
        break;
      }
      case 'PERCENT_OF_RETAIL': {
        const retail = retailPriceMinor ?? 0;
        amount = Math.ceil(retail * (pricing.percent / 100));
        if (pricing.minMinor && amount < pricing.minMinor) amount = pricing.minMinor;
        if (pricing.maxMinor && amount > pricing.maxMinor) amount = pricing.maxMinor;
        break;
      }
      case 'PER_DAY':
        amount = pricing.amountMinor * billableDays;
        break;
      default:
        return null;
    }

    // For DISCOUNT type, amount should be negative
    if (component.type === 'DISCOUNT' || component.type === 'SURCHARGE') {
      // Discounts are negative, surcharges are positive
      if (component.type === 'DISCOUNT') {
        amount = -Math.abs(amount);
      }
    }

    return {
      type: component.type === 'FEE' ? this.getFeeSubType(config.label) : component.type,
      label: config.label,
      amountMinor: amount,
      refundable: component.refundable,
      visibility: component.visibility as 'CUSTOMER' | 'STAFF_ONLY',
      chargeTiming: component.chargeTiming,
      metadata: { componentId: component.id },
    };
  }

  private getFeeSubType(label: string): string {
    const lower = label.toLowerCase();
    if (lower.includes('clean')) return 'CLEANING_FEE';
    if (lower.includes('backup') || lower.includes('size')) return 'BACKUP_SIZE';
    if (lower.includes('try') || lower.includes('trial')) return 'TRY_ON';
    return 'FEE';
  }

  // =========================================================================
  // LATE FEE CALCULATION
  // =========================================================================

  computeLateFee(
    policy: LateFeePolicy | null,
    baseRentalMinor: number,
    lateDays: number,
  ): number {
    if (!policy || !policy.enabled || lateDays <= 0) return 0;

    // Apply grace period (convert grace hours to days for comparison)
    const graceDays = Math.ceil(policy.graceHours / 24);
    const effectiveLateDays = lateDays - graceDays;
    if (effectiveLateDays <= 0) return 0;

    let lateFee = 0;

    switch (policy.mode) {
      case 'PER_DAY':
        lateFee = (policy.amountMinor ?? 0) * effectiveLateDays;
        break;
      case 'FLAT':
        lateFee = policy.amountMinor ?? 0;
        break;
      case 'PERCENT_BASE':
        lateFee = Math.ceil(baseRentalMinor * ((policy.percent ?? 0) / 100) * effectiveLateDays);
        break;
    }

    // Apply cap
    if (policy.totalCapMinor && lateFee > policy.totalCapMinor) {
      lateFee = policy.totalCapMinor;
    }

    return lateFee;
  }

  // =========================================================================
  // CACHING UTILITIES
  // =========================================================================

  computeInputsHash(input: QuoteInput): string {
    const normalized = {
      t: input.tenantId,
      p: input.productId,
      v: input.variantId || '',
      s: input.startAt.toISOString(),
      e: input.endAt.toISOString(),
      ctx: input.context ? JSON.stringify(input.context) : '',
      addons: (input.selectedAddons || []).sort().join(','),
    };

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .substring(0, 32);
  }

  // =========================================================================
  // HEADLINE PRICE (for product cards)
  // =========================================================================

  /**
   * Computes the "headline" price to show on product cards.
   * Returns { price, label } e.g. { price: 2500, label: "/day" }
   */
  computeHeadlinePrice(
    policyVersion: {
      ratePlans: Array<{ type: string; config: any; priority: number }>;
      presentationConfig: any;
    } | null,
  ): { price: number; label: string; includedDays?: number } | null {
    if (!policyVersion || !policyVersion.ratePlans.length) return null;

    // Use highest priority rate plan
    const ratePlan = policyVersion.ratePlans.sort(
      (a, b) => b.priority - a.priority,
    )[0];

    const config = ratePlan.config;

    switch (ratePlan.type) {
      case 'PER_DAY':
        return {
          price: (config as PerDayConfig).unitPriceMinor,
          label: '/day',
          includedDays: undefined,
        };
      case 'FLAT_PERIOD':
        return {
          price: (config as FlatPeriodConfig).flatPriceMinor,
          label: `/${(config as FlatPeriodConfig).includedDays} days`,
          includedDays: (config as FlatPeriodConfig).includedDays,
        };
      case 'TIERED_DAILY': {
        const firstTier = (config as TieredDailyConfig).tiers?.[0];
        return {
          price: firstTier?.pricePerDayMinor ?? 0,
          label: '/day',
        };
      }
      case 'WEEKLY_MONTHLY': {
        const wm = config as WeeklyMonthlyConfig;
        if (wm.dailyPriceMinor) return { price: wm.dailyPriceMinor, label: '/day' };
        if (wm.weeklyPriceMinor) return { price: wm.weeklyPriceMinor, label: '/week' };
        if (wm.monthlyPriceMinor) return { price: wm.monthlyPriceMinor, label: '/month' };
        return null;
      }
      case 'PERCENT_RETAIL':
        return {
          price: 0, // Computed dynamically from retail price
          label: `${(config as PercentRetailConfig).percent}% of retail`,
        };
      default:
        return null;
    }
  }
}
