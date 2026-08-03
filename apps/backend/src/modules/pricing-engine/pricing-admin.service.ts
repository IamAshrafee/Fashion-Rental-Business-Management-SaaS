import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
      lateFeePolicy?: Record<string, unknown>;
      presentationConfig?: Record<string, unknown>;
    },
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Product not found');

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
    });
  }

  // =========================================================================
  // DELETE PRICING PROFILE
  // =========================================================================

  async deletePricingProfile(tenantId: string, productId: string) {
    const profile = await this.prisma.pricingProfile.findFirst({
      where: { productId, tenantId },
    });

    if (!profile) {
      throw new NotFoundException('Pricing profile not found');
    }

    await this.prisma.pricingProfile.delete({
      where: { id: profile.id },
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
}
