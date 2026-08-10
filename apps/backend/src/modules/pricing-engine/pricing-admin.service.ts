import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface LateFeePolicyInput {
  enabled: boolean;
  graceHours?: number;
  mode?: string;
  amountMinor?: number;
  percent?: number;
  totalCapMinor?: number;
}

@Injectable()
export class PricingAdminService {
  private readonly logger = new Logger(PricingAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // GET PRICING PROFILE
  // =========================================================================

  /**
   * Returns the full pricing profile + active policy version for a product.
   * Returns null until pricing has been configured for the product.
   */
  async getPricingProfile(tenantId: string, productId: string) {
    const profile = await this.prisma.pricingProfile.findFirst({
      where: { productId, tenantId },
      include: {
        policyVersions: {
          orderBy: { version: 'desc' },
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

    if (!profile) return null;

    return {
      id: profile.id,
      productId: profile.productId,
      currency: profile.currency,
      timezone: profile.timezone,
      durationMode: profile.durationMode,
      billingRounding: profile.billingRounding,
      activePolicyVersionId: profile.activePolicyVersionId,
      versions: profile.policyVersions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
        lateFeePolicy: v.lateFeePolicy,
        presentationConfig: v.presentationConfig,
        ratePlans: v.ratePlans.map((rp) => ({
          id: rp.id,
          type: rp.type,
          priority: rp.priority,
          config: rp.config,
          conditions: rp.conditionSet?.conditions?.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })) ?? [],
        })),
        components: v.priceComponents.map((pc) => ({
          id: pc.id,
          type: pc.type,
          priority: pc.priority,
          visibility: pc.visibility,
          chargeTiming: pc.chargeTiming,
          refundable: pc.refundable,
          exclusiveGroup: pc.exclusiveGroup,
          config: pc.config,
          conditions: pc.conditionSet?.conditions?.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })) ?? [],
        })),
      })),
    };
  }

  // =========================================================================
  // SAVE PRICING (Create or update pricing profile + publish new version)
  // =========================================================================

  /**
   * Full "save pricing" operation from the admin form:
   * 1. Upsert PricingProfile
   * 2. Archive current active version (if any)
   * 3. Create new PricePolicyVersion with rate plan + components
   * 4. Publish it immediately (ACTIVE)
   *
   * This is designed for the "Simple Mode" admin form where each save
   * creates a new published version atomically.
   */
  async savePricing(
    tenantId: string,
    productId: string,
    input: {
      ratePlan: { type: string; priority?: number; config: Record<string, unknown> };
      components?: Array<{
        type: string;
        priority?: number;
        visibility?: string;
        chargeTiming?: string;
        refundable?: boolean;
        config: Record<string, unknown>;
      }>;
      lateFeePolicy?: LateFeePolicyInput;
      presentationConfig?: Record<string, unknown>;
    },
    actorUserId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.savePricingInTransaction(tx, tenantId, productId, input, actorUserId),
    );
  }

  async savePricingInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    input: {
      ratePlan: { type: string; priority?: number; config: Record<string, unknown> };
      components?: Array<{
        type: string;
        priority?: number;
        visibility?: string;
        chargeTiming?: string;
        refundable?: boolean;
        config: Record<string, unknown>;
      }>;
      lateFeePolicy?: LateFeePolicyInput;
      presentationConfig?: Record<string, unknown>;
    },
    actorUserId?: string,
  ) {
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId, deletedAt: null },
        select: { id: true, purchasePrice: true },
      });
      if (!product) throw new NotFoundException('Product not found');
      this.validatePricingConfiguration(input, product.purchasePrice);

      // 1. Upsert PricingProfile
      let profile = await tx.pricingProfile.findUnique({
        where: { productId },
      });

      if (!profile) {
        profile = await tx.pricingProfile.create({
          data: {
            tenantId,
            productId,
          },
        });
      }

      // 2. Archive current active version
      await tx.pricePolicyVersion.updateMany({
        where: {
          pricingProfileId: profile.id,
          status: 'ACTIVE',
        },
        data: { status: 'ARCHIVED' },
      });

      // 3. Get next version number
      const latestVersion = await tx.pricePolicyVersion.findFirst({
        where: { pricingProfileId: profile.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // 4. Create new policy version
      const policyVersion = await tx.pricePolicyVersion.create({
        data: {
          pricingProfileId: profile.id,
          version: nextVersion,
          status: 'ACTIVE',
          publishedAt: new Date(),
          lateFeePolicy: (input.lateFeePolicy as any) ?? Prisma.JsonNull,
          presentationConfig: (input.presentationConfig as any) ?? Prisma.JsonNull,
          createdBy: actorUserId ?? null,
        },
      });

      // 5. Create rate plan
      await tx.ratePlan.create({
        data: {
          policyVersionId: policyVersion.id,
          type: input.ratePlan.type as any,
          priority: input.ratePlan.priority ?? 100,
          config: input.ratePlan.config as any,
        },
      });

      // 6. Create components
      if (input.components?.length) {
        await tx.priceComponent.createMany({
          data: input.components.map((c, index) => ({
            policyVersionId: policyVersion.id,
            type: c.type as any,
            priority: c.priority ?? (100 - index * 10),
            visibility: (c.visibility as any) ?? 'CUSTOMER',
            chargeTiming: (c.chargeTiming as any) ?? 'AT_BOOKING',
            refundable: c.refundable ?? false,
            config: c.config as any,
          })),
        });
      }

      // 7. Update active version pointer
      const headline = this.deriveHeadline(input.ratePlan.type, input.ratePlan.config);
      await tx.pricingProfile.update({
        where: { id: profile.id },
        data: {
          activePolicyVersionId: policyVersion.id,
          headlinePriceMinor: headline.price,
          headlineLabel: headline.label,
        },
      });

      this.logger.log(
        `Pricing v${nextVersion} published for product ${productId}`,
      );

      return {
        profileId: profile.id,
        policyVersionId: policyVersion.id,
        version: nextVersion,
      };
  }

  // =========================================================================
  // DELETE PRICING PROFILE
  // =========================================================================

  async deletePricingProfile(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { status: true, pricingProfile: { select: { id: true } } },
    });

    if (!product?.pricingProfile) {
      throw new NotFoundException('Pricing profile not found');
    }
    if (product.status === 'published') {
      throw new ConflictException({
        code: 'PUBLISHED_PRICING_LOCKED',
        section: 'pricing',
        message: 'Unpublish this product before removing its pricing policy.',
      });
    }

    await this.prisma.pricingProfile.delete({
      where: { id: product.pricingProfile.id },
    });

    return { message: 'Pricing profile deleted' };
  }

  private deriveHeadline(
    type: string,
    config: Record<string, unknown>,
  ): { price: number; label: string | null } {
    const number = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    if (type === 'PER_DAY') return { price: number(config.unitPriceMinor), label: '/day' };
    if (type === 'FLAT_PERIOD') {
      const days = number(config.includedDays);
      return {
        price: number(config.flatPriceMinor),
        label: days > 0 ? `/${days} days` : null,
      };
    }
    if (type === 'TIERED_DAILY') {
      const tiers = Array.isArray(config.tiers) ? config.tiers : [];
      const first = tiers[0] as Record<string, unknown> | undefined;
      return { price: number(first?.pricePerDayMinor), label: '/day' };
    }
    if (type === 'WEEKLY_MONTHLY') {
      return {
        price:
          number(config.dailyPriceMinor) ||
          number(config.weeklyPriceMinor) ||
          number(config.monthlyPriceMinor),
        label: null,
      };
    }
    if (type === 'PERCENT_RETAIL') {
      return { price: number(config.minPriceMinor), label: `${number(config.percent)}% of retail` };
    }
    return { price: 0, label: null };
  }

  private validatePricingConfiguration(
    input: {
      ratePlan: { type: string; config: Record<string, unknown> };
      components?: Array<{
        type: string;
        refundable?: boolean;
        config: Record<string, unknown>;
      }>;
      lateFeePolicy?: LateFeePolicyInput;
    },
    purchasePrice: number | null,
  ): void {
    const config = input.ratePlan.config;
    const integer = (value: unknown, minimum = 0): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value >= minimum;
    const positiveMoney = (value: unknown) => integer(value, 1);
    const optionalMoney = (value: unknown) => value === undefined || integer(value, 0);
    const fail = (field: string, message: string): never => {
      throw new BadRequestException({
        code: 'INVALID_PRICING_CONFIGURATION',
        section: 'pricing',
        field,
        message,
      });
    };

    switch (input.ratePlan.type) {
      case 'PER_DAY': {
        if (!positiveMoney(config.unitPriceMinor)) fail('ratePlan.config.unitPriceMinor', 'Daily rental price must be a positive integer amount.');
        const minDays = config.minDays ?? 1;
        if (!integer(minDays, 1)) fail('ratePlan.config.minDays', 'Minimum rental days must be at least 1.');
        const validatedMinDays = minDays as number;
        if (config.maxDays !== undefined && (!integer(config.maxDays, validatedMinDays) || config.maxDays < validatedMinDays)) {
          fail('ratePlan.config.maxDays', 'Maximum rental days must be an integer greater than or equal to the minimum.');
        }
        break;
      }
      case 'FLAT_PERIOD': {
        if (!positiveMoney(config.flatPriceMinor)) fail('ratePlan.config.flatPriceMinor', 'Package rental price must be a positive integer amount.');
        if (!integer(config.includedDays, 1)) fail('ratePlan.config.includedDays', 'Included rental days must be at least 1.');
        const includedDays = config.includedDays as number;
        if (!optionalMoney(config.extraDayPriceMinor)) fail('ratePlan.config.extraDayPriceMinor', 'Extra-day price must be a non-negative integer amount.');
        if (config.maxDays !== undefined && (!integer(config.maxDays, includedDays) || config.maxDays < includedDays)) {
          fail('ratePlan.config.maxDays', 'Maximum rental days cannot be shorter than the package period.');
        }
        break;
      }
      case 'TIERED_DAILY': {
        const tiers = Array.isArray(config.tiers) ? config.tiers : [];
        if (tiers.length === 0 || tiers.length > 50) fail('ratePlan.config.tiers', 'Configure between 1 and 50 daily pricing tiers.');
        let expectedFromDay = 1;
        tiers.forEach((value, index) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            fail(`ratePlan.config.tiers.${index}`, 'Each tier must be an object.');
          }
          const tier = value as Record<string, unknown>;
          if (tier.fromDay !== expectedFromDay) {
            fail(`ratePlan.config.tiers.${index}.fromDay`, `Tier ${index + 1} must start on day ${expectedFromDay}.`);
          }
          if (!positiveMoney(tier.pricePerDayMinor)) {
            fail(`ratePlan.config.tiers.${index}.pricePerDayMinor`, 'Every tier needs a positive daily price.');
          }
          if (tier.toDay === null) {
            if (index !== tiers.length - 1) fail(`ratePlan.config.tiers.${index}.toDay`, 'Only the final tier can have no end day.');
          } else {
            if (!integer(tier.toDay, expectedFromDay)) fail(`ratePlan.config.tiers.${index}.toDay`, 'Tier end day must be on or after its start day.');
            expectedFromDay = (tier.toDay as number) + 1;
          }
        });
        if ((tiers[tiers.length - 1] as Record<string, unknown>).toDay !== null) {
          fail(`ratePlan.config.tiers.${tiers.length - 1}.toDay`, 'The final tier must cover all later rental days.');
        }
        if (config.minDays !== undefined && !integer(config.minDays, 1)) fail('ratePlan.config.minDays', 'Minimum rental days must be at least 1.');
        break;
      }
      case 'WEEKLY_MONTHLY':
        if (!positiveMoney(config.dailyPriceMinor)) fail('ratePlan.config.dailyPriceMinor', 'A positive daily fallback price is required.');
        if (!optionalMoney(config.weeklyPriceMinor) || !optionalMoney(config.monthlyPriceMinor)) {
          fail('ratePlan.config', 'Weekly and monthly prices must be non-negative integer amounts.');
        }
        if (typeof config.optimizeCost !== 'boolean') fail('ratePlan.config.optimizeCost', 'Choose whether the engine should optimize package cost.');
        break;
      case 'PERCENT_RETAIL':
        if (typeof config.percent !== 'number' || !Number.isFinite(config.percent) || config.percent <= 0 || config.percent > 100) {
          fail('ratePlan.config.percent', 'Retail percentage must be greater than 0 and no more than 100.');
        }
        if (!['PER_DAY', 'PER_RENTAL'].includes(String(config.basis))) fail('ratePlan.config.basis', 'Choose a valid retail-percentage basis.');
        if (!purchasePrice || purchasePrice <= 0) fail('purchasePrice', 'A positive purchase price is required for percentage-of-retail pricing.');
        if (!optionalMoney(config.minPriceMinor) || !optionalMoney(config.maxPriceMinor)) fail('ratePlan.config', 'Minimum and maximum prices must be non-negative integer amounts.');
        if (
          typeof config.minPriceMinor === 'number' &&
          typeof config.maxPriceMinor === 'number' &&
          config.maxPriceMinor > 0 &&
          config.minPriceMinor > config.maxPriceMinor
        ) fail('ratePlan.config.maxPriceMinor', 'Maximum price cannot be lower than the minimum price.');
        break;
      default:
        fail('ratePlan.type', 'Choose a supported rental pricing model.');
    }

    const identities = new Set<string>();
    for (const [index, component] of (input.components ?? []).entries()) {
      const componentConfig = component.config;
      const label = componentConfig.label;
      if (typeof label !== 'string' || label.trim().length === 0 || label.trim().length > 120) {
        fail(`components.${index}.config.label`, 'Every fee, deposit, discount, or add-on needs a label of 120 characters or fewer.');
      }
      const pricing = componentConfig.pricing;
      if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) {
        fail(`components.${index}.config.pricing`, 'Every pricing component needs a pricing rule.');
      }
      const rule = pricing as Record<string, unknown>;
      if (rule.mode === 'FLAT' || rule.mode === 'PER_DAY') {
        if (!positiveMoney(rule.amountMinor)) fail(`components.${index}.config.pricing.amountMinor`, 'Component amount must be a positive integer.');
      } else if (rule.mode === 'PERCENT_OF_BASE' || rule.mode === 'PERCENT_OF_RETAIL') {
        if (typeof rule.percent !== 'number' || rule.percent <= 0 || rule.percent > 100) {
          fail(`components.${index}.config.pricing.percent`, 'Component percentage must be greater than 0 and no more than 100.');
        }
        for (const key of ['capMinor', 'minMinor', 'maxMinor']) {
          if (!optionalMoney(rule[key])) fail(`components.${index}.config.pricing.${key}`, 'Component bounds must be non-negative integer amounts.');
        }
        if (rule.mode === 'PERCENT_OF_RETAIL' && (!purchasePrice || purchasePrice <= 0)) {
          fail('purchasePrice', 'A positive purchase price is required for retail-based components.');
        }
      } else {
        fail(`components.${index}.config.pricing.mode`, 'Choose a supported component pricing mode.');
      }

      if (component.type === 'DEPOSIT' && component.refundable !== true) {
        fail(`components.${index}.refundable`, 'Security deposits must be refundable.');
      }
      if (component.type !== 'DEPOSIT' && component.refundable === true) {
        fail(`components.${index}.refundable`, 'Only security deposits can be marked refundable.');
      }
      const purpose = typeof componentConfig.purpose === 'string' ? componentConfig.purpose.trim() : '';
      const addonId = typeof componentConfig.addonId === 'string' ? componentConfig.addonId.trim() : '';
      const identity = component.type === 'ADDON' ? `ADDON:${addonId || purpose || label}` : `${component.type}:${purpose || label}`;
      if (identities.has(identity)) fail(`components.${index}`, 'Duplicate pricing components are not allowed.');
      identities.add(identity);
    }

    const lateFee = input.lateFeePolicy;
    if (lateFee?.enabled === true) {
      if (!integer(lateFee.graceHours ?? 0, 0)) fail('lateFeePolicy.graceHours', 'Late-fee grace hours must be a non-negative integer.');
      if (!['PER_DAY', 'FLAT', 'PERCENT_BASE'].includes(String(lateFee.mode))) fail('lateFeePolicy.mode', 'Choose a valid late-fee mode.');
      if (lateFee.mode === 'PERCENT_BASE') {
        if (typeof lateFee.percent !== 'number' || lateFee.percent <= 0 || lateFee.percent > 100) fail('lateFeePolicy.percent', 'Late-fee percentage must be greater than 0 and no more than 100.');
      } else if (!positiveMoney(lateFee.amountMinor)) {
        fail('lateFeePolicy.amountMinor', 'Late-fee amount must be a positive integer.');
      }
      if (lateFee.totalCapMinor !== undefined && !positiveMoney(lateFee.totalCapMinor)) fail('lateFeePolicy.totalCapMinor', 'Late-fee cap must be a positive integer amount.');
    }

    const headline = this.deriveHeadline(input.ratePlan.type, input.ratePlan.config);
    if (headline.price <= 0) fail('ratePlan.config', 'The pricing model must produce a positive storefront price.');
  }
}
