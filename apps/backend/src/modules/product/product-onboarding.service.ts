import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ProductOnboardingSection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingAdminService } from '../pricing-engine/pricing-admin.service';
import {
  OnboardingVariantDto,
  PublishOnboardedProductDto,
  SaveProductBasicsDto,
  SaveProductContentDto,
  SaveProductPricingSectionDto,
  SaveProductSkusDto,
  StartProductOnboardingDto,
} from './dto/product-onboarding.dto';
import { ProductService } from './product.service';
import { SubscriptionService } from '../tenant/subscription.service';

const SECTION_ORDER: ProductOnboardingSection[] = [
  'BASICS',
  'SKUS',
  'CONTENT',
  'PRICING',
  'REVIEW',
];

type Transaction = Prisma.TransactionClient;

@Injectable()
export class ProductOnboardingService {
  private readonly subscriptions: SubscriptionService;
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductService,
    private readonly pricing: PricingAdminService,
  ) {
    this.subscriptions = new SubscriptionService(prisma);
  }

  async start(
    tenantId: string,
    actorUserId: string,
    dto: StartProductOnboardingDto,
    idempotencyKey?: string,
  ) {
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const requestHash = this.hash({ section: 'BASICS', input: dto });

    const existingProduct = await this.prisma.product.findFirst({
      where: { tenantId, creationKey: commandKey },
      select: { id: true },
    });
    if (!existingProduct) await this.subscriptions.enforcePlanLimit(tenantId, 'products');

    let productId: string;
    try {
      productId = await this.withSerializableRetry(async (tx) => {
        const replay = await this.findReplay(tx, tenantId, commandKey, requestHash, 'BASICS');
        if (replay) return replay.productId;

        await this.validateCatalogReferences(tx, tenantId, dto);
        const product =
          (await tx.product.findFirst({
            where: { tenantId, creationKey: commandKey },
            select: { id: true },
          })) ??
          (await tx.product.create({
            data: {
              tenantId,
              creationKey: commandKey,
              name: dto.name.trim(),
              slug: await this.generateUniqueSlug(tx, tenantId, dto.name),
              categoryId: dto.categoryId,
              subcategoryId: dto.subcategoryId ?? null,
              productTypeId: dto.productTypeId,
              sizeSchemaOverrideId: dto.sizeSchemaOverrideId ?? null,
              status: 'draft',
              countryOfOrigin: dto.countryOfOrigin?.trim() || null,
              countryOfOriginPublic: dto.countryOfOriginPublic ?? false,
              referenceRetailValue: dto.referenceRetailValue ?? null,
              referenceRetailValuePublic: dto.referenceRetailValuePublic ?? false,
              storefrontItemMode: dto.storefrontItemMode ?? 'INTERNAL_ONLY',
            },
            select: { id: true },
          }));

        const existingOnboarding = await tx.productOnboarding.findUnique({
          where: { productId: product.id },
        });
        if (existingOnboarding) {
          throw new ConflictException({
            code: 'PRODUCT_CREATION_KEY_REUSED',
            message: 'This creation key already belongs to another onboarding request.',
          });
        }

        if (dto.eventIds?.length) {
          await tx.productEvent.createMany({
            data: dto.eventIds.map((eventId) => ({ productId: product.id, eventId })),
          });
        }

        const onboarding = await tx.productOnboarding.create({
          data: {
            tenantId,
            productId: product.id,
            currentSection: 'SKUS',
            completedSections: ['BASICS'],
            revision: 1,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
        await tx.productOnboardingCommand.create({
          data: {
            tenantId,
            onboardingId: onboarding.id,
            section: 'BASICS',
            idempotencyKey: commandKey,
            requestHash,
            revisionBefore: 0,
            revisionAfter: 1,
            result: { productId: product.id, revision: 1 },
            actorUserId,
          },
        });
        return product.id;
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const replay = await this.prisma.productOnboardingCommand.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: commandKey } },
        select: {
          requestHash: true,
          section: true,
          onboarding: { select: { productId: true } },
        },
      });
      if (!replay) throw error;
      if (replay.requestHash !== requestHash || replay.section !== 'BASICS') {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          section: 'BASICS',
          message: 'This idempotency key was already used for different product basics.',
        });
      }
      productId = replay.onboarding.productId;
    }

    return this.get(tenantId, productId);
  }

  async get(tenantId: string, productId: string) {
    const onboarding = await this.prisma.productOnboarding.findFirst({
      where: { tenantId, productId, product: { deletedAt: null } },
      include: {
        updatedBy: { select: { id: true, fullName: true } },
        _count: { select: { commands: true } },
      },
    });
    if (!onboarding) throw new NotFoundException('Product onboarding not found');

    const [product, readiness] = await Promise.all([
      this.products.getById(tenantId, productId),
      this.products.getReadiness(tenantId, productId),
    ]);
    const completed = new Set(onboarding.completedSections);
    const nextSection = SECTION_ORDER.find((section) => !completed.has(section)) ?? 'REVIEW';

    return {
      id: onboarding.id,
      productId,
      currentSection: onboarding.currentSection,
      completedSections: onboarding.completedSections,
      nextSection,
      revision: onboarding.revision,
      lastSavedAt: onboarding.updatedAt,
      lastSavedBy: onboarding.updatedBy,
      commandCount: onboarding._count.commands,
      product,
      readiness,
    };
  }

  saveBasics(
    tenantId: string,
    productId: string,
    actorUserId: string,
    dto: SaveProductBasicsDto,
    idempotencyKey?: string,
  ) {
    return this.executeSection(
      tenantId,
      productId,
      actorUserId,
      'BASICS',
      dto.expectedRevision,
      idempotencyKey,
      dto,
      async (tx) => {
        await this.validateCatalogReferences(tx, tenantId, dto);
        await tx.product.update({
          where: { id: productId },
          data: {
            name: dto.name.trim(),
            slug: await this.generateUniqueSlug(tx, tenantId, dto.name, productId),
            categoryId: dto.categoryId,
            subcategoryId: dto.subcategoryId ?? null,
            productTypeId: dto.productTypeId,
            sizeSchemaOverrideId: dto.sizeSchemaOverrideId ?? null,
            countryOfOrigin: dto.countryOfOrigin?.trim() || null,
            countryOfOriginPublic: dto.countryOfOriginPublic ?? false,
            referenceRetailValue: dto.referenceRetailValue ?? null,
            referenceRetailValuePublic: dto.referenceRetailValuePublic ?? false,
            storefrontItemMode: dto.storefrontItemMode ?? 'INTERNAL_ONLY',
          },
        });
        await tx.productEvent.deleteMany({ where: { productId } });
        if (dto.eventIds?.length) {
          await tx.productEvent.createMany({
            data: dto.eventIds.map((eventId) => ({ productId, eventId })),
          });
        }
      },
    );
  }

  saveSkus(
    tenantId: string,
    productId: string,
    actorUserId: string,
    dto: SaveProductSkusDto,
    idempotencyKey?: string,
  ) {
    return this.executeSection(
      tenantId,
      productId,
      actorUserId,
      'SKUS',
      dto.expectedRevision,
      idempotencyKey,
      dto,
      async (tx) => {
        await this.reconcileSkus(tx, tenantId, productId, dto.variants);
      },
    );
  }

  saveContent(
    tenantId: string,
    productId: string,
    actorUserId: string,
    dto: SaveProductContentDto,
    idempotencyKey?: string,
  ) {
    return this.executeSection(
      tenantId,
      productId,
      actorUserId,
      'CONTENT',
      dto.expectedRevision,
      idempotencyKey,
      dto,
      async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: { tenantId, productId },
          select: {
            id: true,
            images: { where: { isFeatured: true }, take: 1, select: { id: true } },
          },
        });
        const missingMedia = variants.filter((variant) => variant.images.length === 0);
        if (missingMedia.length) {
          throw new UnprocessableEntityException({
            code: 'ONBOARDING_CONTENT_INCOMPLETE',
            section: 'CONTENT',
            message: 'Every variant needs a featured storefront image.',
            entityIds: missingMedia.map((variant) => variant.id),
          });
        }

        await tx.product.update({
          where: { id: productId },
          data: { description: dto.description?.trim() || null },
        });
        await tx.productFaq.deleteMany({ where: { productId } });
        if (dto.faqs?.length) {
          await tx.productFaq.createMany({
            data: dto.faqs.map((faq, sequence) => ({
              tenantId,
              productId,
              question: faq.question.trim(),
              answer: faq.answer.trim(),
              sequence,
            })),
          });
        }
        await tx.productDetailHeader.deleteMany({ where: { productId } });
        for (const [sequence, detail] of (dto.details ?? []).entries()) {
          const header = await tx.productDetailHeader.create({
            data: {
              tenantId,
              productId,
              headerName: detail.headerName.trim(),
              sequence: detail.sequence ?? sequence,
            },
          });
          if (detail.entries?.length) {
            await tx.productDetailEntry.createMany({
              data: detail.entries.map((entry, entrySequence) => ({
                headerId: header.id,
                key: entry.key.trim(),
                value: entry.value.trim(),
                sequence: entrySequence,
              })),
            });
          }
        }
      },
    );
  }

  savePricing(
    tenantId: string,
    productId: string,
    actorUserId: string,
    dto: SaveProductPricingSectionDto,
    idempotencyKey?: string,
  ) {
    return this.executeSection(
      tenantId,
      productId,
      actorUserId,
      'PRICING',
      dto.expectedRevision,
      idempotencyKey,
      dto,
      (tx) =>
        this.pricing.savePricingInTransaction(tx, tenantId, productId, dto.pricing, actorUserId),
    );
  }

  publish(
    tenantId: string,
    productId: string,
    actorUserId: string,
    dto: PublishOnboardedProductDto,
    idempotencyKey?: string,
  ) {
    return this.executeSection(
      tenantId,
      productId,
      actorUserId,
      'REVIEW',
      dto.expectedRevision,
      idempotencyKey,
      dto,
      async (tx, onboarding) => {
        const required: ProductOnboardingSection[] = [
          'BASICS',
          'SKUS',
          'CONTENT',
          'PRICING',
        ];
        const missing = required.filter(
          (section) => !onboarding.completedSections.includes(section),
        );
        if (missing.length) {
          throw new UnprocessableEntityException({
            code: 'ONBOARDING_SECTIONS_INCOMPLETE',
            section: 'REVIEW',
            missingSections: missing,
            message: 'Complete every required onboarding section before publishing.',
          });
        }
        const readiness = await this.products.getReadinessWithClient(tx, tenantId, productId);
        if (!readiness.ready) {
          throw new UnprocessableEntityException({
            code: 'PRODUCT_NOT_READY',
            section: 'REVIEW',
            blockers: readiness.blockers,
            message: 'Resolve the product readiness blockers before publishing.',
          });
        }
        await tx.product.update({ where: { id: productId }, data: { status: 'published' } });
      },
    );
  }

  private async executeSection(
    tenantId: string,
    productId: string,
    actorUserId: string,
    section: ProductOnboardingSection,
    expectedRevision: number,
    idempotencyKey: string | undefined,
    input: unknown,
    action: (
      tx: Transaction,
      onboarding: { id: string; revision: number; completedSections: ProductOnboardingSection[] },
    ) => Promise<unknown>,
  ) {
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const requestHash = this.hash({ section, productId, input });
    await this.withSerializableRetry(async (tx) => {
      const replay = await this.findReplay(
        tx,
        tenantId,
        commandKey,
        requestHash,
        section,
        productId,
      );
      if (replay) return;

      const found = await tx.productOnboarding.findFirst({
        where: { tenantId, productId, product: { deletedAt: null, status: 'draft' } },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Active product onboarding not found');
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM product_onboardings
        WHERE id = ${found.id} AND tenant_id = ${tenantId}
        FOR UPDATE
      `);
      const onboarding = await tx.productOnboarding.findUniqueOrThrow({
        where: { id: found.id },
        select: { id: true, revision: true, completedSections: true },
      });
      const lockedReplay = await this.findReplay(
        tx,
        tenantId,
        commandKey,
        requestHash,
        section,
        productId,
      );
      if (lockedReplay) return;
      if (onboarding.revision !== expectedRevision) {
        throw new ConflictException({
          code: 'STALE_PRODUCT_ONBOARDING',
          section,
          expectedRevision,
          currentRevision: onboarding.revision,
          message:
            'This product changed after you loaded it. Refresh and review the latest saved section.',
        });
      }
      this.assertDependencies(section, onboarding.completedSections);
      await action(tx, onboarding);

      const completedSections = [...new Set([...onboarding.completedSections, section])];
      const nextSection =
        SECTION_ORDER.find((candidate) => !completedSections.includes(candidate)) ?? 'REVIEW';
      const revisionAfter = onboarding.revision + 1;
      await tx.productOnboarding.update({
        where: { id: onboarding.id },
        data: {
          completedSections,
          currentSection: nextSection,
          revision: revisionAfter,
          updatedByUserId: actorUserId,
        },
      });
      await tx.productOnboardingCommand.create({
        data: {
          tenantId,
          onboardingId: onboarding.id,
          section,
          idempotencyKey: commandKey,
          requestHash,
          revisionBefore: onboarding.revision,
          revisionAfter,
          result: { productId, revision: revisionAfter },
          actorUserId,
        },
      });
    });
    return this.get(tenantId, productId);
  }

  private assertDependencies(
    section: ProductOnboardingSection,
    completed: ProductOnboardingSection[],
  ) {
    const requiredBySection: Partial<Record<ProductOnboardingSection, ProductOnboardingSection[]>> =
      {
        SKUS: ['BASICS'],
        CONTENT: ['BASICS', 'SKUS'],
        PRICING: ['BASICS', 'SKUS'],
        REVIEW: ['BASICS', 'SKUS', 'CONTENT', 'PRICING'],
      };
    const missing = (requiredBySection[section] ?? []).filter(
      (value) => !completed.includes(value),
    );
    if (missing.length) {
      throw new UnprocessableEntityException({
        code: 'ONBOARDING_DEPENDENCY_INCOMPLETE',
        section,
        missingSections: missing,
        message: `Complete ${missing.join(', ')} before saving ${section}.`,
      });
    }
  }

  private async findReplay(
    tx: Transaction,
    tenantId: string,
    key: string,
    requestHash: string,
    section: ProductOnboardingSection,
    productId?: string,
  ): Promise<{ productId: string } | null> {
    const command = await tx.productOnboardingCommand.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      select: {
        requestHash: true,
        section: true,
        onboarding: { select: { productId: true } },
      },
    });
    if (!command) return null;
    if (
      command.requestHash !== requestHash ||
      command.section !== section ||
      (productId !== undefined && command.onboarding.productId !== productId)
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        section,
        message: 'This idempotency key was already used for a different onboarding command.',
      });
    }
    return { productId: command.onboarding.productId };
  }

  private async withSerializableRetry<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw new ConflictException({
      code: 'ONBOARDING_CONCURRENCY_RETRY_EXHAUSTED',
      message: 'The product changed repeatedly. Refresh and retry.',
    });
  }

  private async reconcileSkus(
    tx: Transaction,
    tenantId: string,
    productId: string,
    variants: OnboardingVariantDto[],
  ) {
    const clientKeys = variants.map((variant) => variant.clientKey.trim());
    if (new Set(clientKeys).size !== clientKeys.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_VARIANT_KEY',
        section: 'SKUS',
        message: 'Every variant row must have a unique client key.',
      });
    }
    for (const [index, variant] of variants.entries()) {
      const sizeIds = variant.sizes.map((size) => size.sizeInstanceId);
      if (new Set(sizeIds).size !== sizeIds.length) {
        throw new BadRequestException({
          code: 'DUPLICATE_SKU_SIZE',
          section: 'SKUS',
          row: index,
          message: 'A size can appear only once in a variant.',
        });
      }
    }

    const product = await tx.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null, status: 'draft' },
      select: {
        sizeSchemaOverrideId: true,
        productType: { select: { defaultSizeSchemaId: true } },
      },
    });
    if (!product) throw new NotFoundException('Draft product not found');
    const activeSchemaId = product.sizeSchemaOverrideId ?? product.productType?.defaultSizeSchemaId;
    if (!activeSchemaId) {
      throw new UnprocessableEntityException({
        code: 'SIZE_SCHEMA_REQUIRED',
        section: 'SKUS',
        message: 'Choose a product type with an active size system before creating SKUs.',
      });
    }
    const allSizeIds = [
      ...new Set(variants.flatMap((variant) => variant.sizes.map((size) => size.sizeInstanceId))),
    ];
    const validSizeCount = await tx.sizeInstance.count({
      where: {
        id: { in: allSizeIds },
        sizeSchemaId: activeSchemaId,
        sizeSchema: { tenantId, status: 'active' },
      },
    });
    if (validSizeCount !== allSizeIds.length) {
      throw new BadRequestException({
        code: 'INVALID_SIZE_REFERENCE',
        section: 'SKUS',
        message: 'One or more selected sizes are not part of this product’s active size system.',
      });
    }
    const colorIds = [
      ...new Set(
        variants.flatMap((variant) => [variant.mainColorId, ...(variant.identicalColorIds ?? [])]),
      ),
    ];
    const validColorCount = await tx.color.count({
      where: { id: { in: colorIds }, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (validColorCount !== colorIds.length) {
      throw new BadRequestException({
        code: 'INVALID_COLOR_REFERENCE',
        section: 'SKUS',
        message: 'One or more selected colors are not available in this store.',
      });
    }

    const existing = await tx.productVariant.findMany({
      where: { tenantId, productId },
      include: { sizes: true },
      orderBy: { sequence: 'asc' },
    });
    const retainedIds = new Set<string>();
    for (const [sequence, requested] of variants.entries()) {
      const variant = requested.id
        ? existing.find((candidate) => candidate.id === requested.id)
        : existing.find((candidate) => candidate.onboardingKey === requested.clientKey);
      if (requested.id && !variant) {
        throw new BadRequestException({
          code: 'INVALID_VARIANT_REFERENCE',
          section: 'SKUS',
          row: sequence,
          message: 'A variant does not belong to this product.',
        });
      }
      const saved = variant
        ? await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              onboardingKey: requested.clientKey,
              variantName: requested.variantName?.trim() || null,
              mainColorId: requested.mainColorId,
              sequence,
            },
          })
        : await tx.productVariant.create({
            data: {
              tenantId,
              productId,
              onboardingKey: requested.clientKey,
              variantName: requested.variantName?.trim() || null,
              mainColorId: requested.mainColorId,
              sequence,
            },
          });
      retainedIds.add(saved.id);

      await tx.variantColor.deleteMany({ where: { variantId: saved.id } });
      const requestedColors = [
        ...new Set([requested.mainColorId, ...(requested.identicalColorIds ?? [])]),
      ];
      await tx.variantColor.createMany({
        data: requestedColors.map((colorId) => ({ variantId: saved.id, colorId })),
      });

      const existingSizes = variant?.sizes ?? [];
      const requestedSizeIds = new Set(requested.sizes.map((size) => size.sizeInstanceId));
      for (const removed of existingSizes.filter(
        (size) => !requestedSizeIds.has(size.sizeInstanceId),
      )) {
        await this.assertSkuHasNoOperationalHistory(tx, tenantId, removed.id);
        await tx.variantSize.delete({ where: { id: removed.id } });
      }
      for (const requestedSize of requested.sizes) {
        const current = existingSizes.find(
          (size) => size.sizeInstanceId === requestedSize.sizeInstanceId,
        );
        if (!current) {
          await tx.variantSize.create({
            data: {
              tenantId,
              variantId: saved.id,
              sizeInstanceId: requestedSize.sizeInstanceId,
            },
          });
        }
      }
    }

    for (const removed of existing.filter((variant) => !retainedIds.has(variant.id))) {
      const bookingCount = await tx.bookingItem.count({
        where: { tenantId, variantId: removed.id },
      });
      if (bookingCount > 0) {
        throw new ConflictException({
          code: 'SKU_HISTORY_CONFLICT',
          section: 'SKUS',
          entityId: removed.id,
          message: 'A variant with booking history cannot be removed.',
        });
      }
      for (const size of removed.sizes) {
        await this.assertSkuHasNoOperationalHistory(tx, tenantId, size.id);
      }
      await tx.productVariant.delete({ where: { id: removed.id } });
    }
  }

  private async assertSkuHasNoOperationalHistory(
    tx: Transaction,
    tenantId: string,
    variantSizeId: string,
  ) {
    const [units, reservations, bookings, movements, requirements, blocks, transfers] =
      await Promise.all([
        tx.stockUnit.count({ where: { tenantId, variantSizeId } }),
        tx.inventoryReservation.count({ where: { tenantId, variantSizeId } }),
        tx.bookingItem.count({ where: { tenantId, variantSizeId } }),
        tx.inventoryMovement.count({ where: { tenantId, variantSizeId } }),
        tx.fulfillmentRequirement.count({ where: { tenantId, variantSizeId } }),
        tx.inventoryBlock.count({ where: { tenantId, variantSizeId } }),
        tx.inventoryTransferLine.count({ where: { tenantId, variantSizeId } }),
      ]);
    if (
      units + reservations + bookings + movements + requirements + blocks + transfers >
      0
    ) {
      throw new ConflictException({
        code: 'SKU_HISTORY_CONFLICT',
        section: 'SKUS',
        entityId: variantSizeId,
        message: 'A SKU with inventory or rental history cannot be restructured.',
      });
    }
  }

  private async validateCatalogReferences(
    tx: Transaction,
    tenantId: string,
    input: StartProductOnboardingDto,
  ) {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!category)
      this.invalidReference('categoryId', 'Choose an active category from this store.');
    if (input.subcategoryId) {
      const subcategory = await tx.subcategory.findFirst({
        where: { id: input.subcategoryId, tenantId, categoryId: input.categoryId, isActive: true },
        select: { id: true },
      });
      if (!subcategory)
        this.invalidReference('subcategoryId', 'Choose a subcategory in the selected category.');
    }
    const productType = await tx.productType.findFirst({
      where: { id: input.productTypeId, tenantId },
      select: { defaultSizeSchemaId: true },
    });
    if (!productType)
      this.invalidReference('productTypeId', 'Choose a product type from this store.');
    const schemaId = input.sizeSchemaOverrideId ?? productType!.defaultSizeSchemaId;
    if (!schemaId)
      this.invalidReference('productTypeId', 'The product type needs an active size system.');
    const schema = await tx.sizeSchema.findFirst({
      where: { id: schemaId!, tenantId, status: 'active' },
      select: { id: true },
    });
    if (!schema)
      this.invalidReference(
        'sizeSchemaOverrideId',
        'Choose an active size system from this store.',
      );
    const eventIds = [...new Set(input.eventIds ?? [])];
    if (eventIds.length) {
      const count = await tx.event.count({
        where: { id: { in: eventIds }, tenantId, isActive: true },
      });
      if (count !== eventIds.length)
        this.invalidReference('eventIds', 'One or more events are unavailable.');
    }
  }

  private invalidReference(field: string, message: string): never {
    throw new BadRequestException({
      code: 'INVALID_CATALOG_REFERENCE',
      section: 'BASICS',
      field,
      message,
    });
  }

  private async generateUniqueSlug(
    tx: Transaction,
    tenantId: string,
    name: string,
    excludeProductId?: string,
  ) {
    const normalized =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'product';
    for (let suffix = 1; suffix <= 10_000; suffix += 1) {
      const slug = suffix === 1 ? normalized : `${normalized}-${suffix}`;
      const exists = await tx.product.count({
        where: { tenantId, slug, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
      });
      if (!exists) return slug;
    }
    throw new ConflictException({
      code: 'PRODUCT_SLUG_EXHAUSTED',
      message: 'Unable to create a unique product URL.',
    });
  }

  private requireIdempotencyKey(value?: string) {
    const key = value?.trim();
    if (!key) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Send an Idempotency-Key for every onboarding command.',
      });
    }
    if (key.length > 128) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_TOO_LONG',
        message: 'Idempotency-Key must be 128 characters or fewer.',
      });
    }
    return key;
  }

  private hash(value: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(this.sortValue(value)))
      .digest('hex');
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.sortValue(entry));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, this.sortValue(entry)]),
      );
    }
    return value;
  }

}
