/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-constant-condition */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProductDto,
  ProductQueryDto,
  OwnerProductQueryDto,
  CreateFaqDto,
  UpdateFaqDto,
  CreateDetailHeaderDto,
  UpdateDetailHeaderDto,
  DetailEntryDto,
} from './dto/product.dto';
import { Prisma, ProductStatus } from '@prisma/client';

export const PRODUCT_READINESS_CODES = [
  'CATEGORY',
  'PRODUCT_TYPE',
  'SIZE_SCHEMA',
  'VARIANT',
  'RENTABLE_SKU',
  'VARIANT_MEDIA',
  'ACTIVE_PRICING',
  'COMPOSITION',
] as const;

export type ProductReadinessCode = (typeof PRODUCT_READINESS_CODES)[number];
export type ProductReadinessSection =
  | 'basic'
  | 'sizing'
  | 'variants'
  | 'pricing'
  | 'composition';

export interface ProductReadinessBlocker {
  code: ProductReadinessCode;
  section: ProductReadinessSection;
  message: string;
  field?: string;
  entityId?: string;
}

export interface ProductReadiness {
  ready: boolean;
  blockers: ProductReadinessBlocker[];
}

const ownerProductListSelect = () => ({
  id: true,
  name: true,
  slug: true,
  status: true,
  storefrontItemMode: true,
  onboarding: {
    select: { currentSection: true, completedSections: true, revision: true, updatedAt: true },
  },
  totalBookings: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  productType: {
    select: {
      id: true,
      name: true,
      slug: true,
      defaultSizeSchema: { select: { id: true, status: true } },
    },
  },
  sizeSchemaOverride: { select: { id: true, status: true } },
  pricingProfile: {
    select: {
      headlinePriceMinor: true,
      headlineLabel: true,
      policyVersions: {
        where: { status: 'ACTIVE' as const },
        take: 1,
        select: {
          ratePlans: {
            orderBy: { priority: 'desc' as const },
            take: 1,
            select: { type: true },
          },
        },
      },
    },
  },
  variants: {
    orderBy: { sequence: 'asc' as const },
    select: {
      id: true,
      variantName: true,
      mainColor: { select: { name: true, hexCode: true } },
      images: {
        where: { isFeatured: true },
        orderBy: { sequence: 'asc' as const },
        take: 1,
        select: { id: true, url: true, thumbnailUrl: true, isFeatured: true },
      },
      sizes: {
        select: {
          id: true,
          sizeInstance: { select: { sizeSchemaId: true } },
          _count: {
            select: {
              stockUnits: {
                where: { disposition: 'ACTIVE' as const, deletedAt: null },
              },
            },
          },
        },
      },
    },
  },
  compositionRules: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      componentProduct: { select: { id: true, status: true, deletedAt: true } },
      alternatives: {
        where: { isActive: true },
        select: { id: true, product: { select: { id: true, status: true, deletedAt: true } } },
      },
    },
  },
  deletedBy: { select: { id: true, fullName: true } },
  _count: { select: { bookingItems: true } },
}) satisfies Prisma.ProductSelect;

type OwnerProductListRecord = Prisma.ProductGetPayload<{
  select: ReturnType<typeof ownerProductListSelect>;
}>;

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================================
  // UPDATE
  // =========================================================================

  async update(tenantId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.findProductOrFail(tenantId, productId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = await this.generateUniqueSlug(tenantId, dto.name, productId);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.subcategoryId !== undefined) data.subcategoryId = dto.subcategoryId || null;
    if (dto.countryOfOrigin !== undefined) data.countryOfOrigin = dto.countryOfOrigin.trim() || null;
    if (dto.countryOfOriginPublic !== undefined) data.countryOfOriginPublic = dto.countryOfOriginPublic;
    if (dto.referenceRetailValue !== undefined) data.referenceRetailValue = dto.referenceRetailValue;
    if (dto.referenceRetailValuePublic !== undefined) data.referenceRetailValuePublic = dto.referenceRetailValuePublic;
    if (dto.storefrontItemMode !== undefined) data.storefrontItemMode = dto.storefrontItemMode;
    if (dto.productTypeId !== undefined) data.productTypeId = dto.productTypeId || null;
    if (dto.sizeSchemaOverrideId !== undefined) data.sizeSchemaOverrideId = dto.sizeSchemaOverrideId || null;

    return this.prisma.$transaction(async (tx) => {
      await this.validateCatalogReferences(
        tx,
        tenantId,
        {
          categoryId: dto.categoryId ?? product.categoryId,
          subcategoryId:
            dto.subcategoryId !== undefined ? dto.subcategoryId || null : product.subcategoryId,
          productTypeId:
            dto.productTypeId !== undefined ? dto.productTypeId || null : product.productTypeId,
          sizeSchemaOverrideId:
            dto.sizeSchemaOverrideId !== undefined
              ? dto.sizeSchemaOverrideId || null
              : product.sizeSchemaOverrideId,
          eventIds: dto.eventIds,
          storefrontItemMode: dto.storefrontItemMode ?? product.storefrontItemMode,
        },
        productId,
      );
      // Update product
      const updated = await tx.product.update({
        where: { id: productId },
        data,
      });

      // Update event associations
      if (dto.eventIds !== undefined) {
        await tx.productEvent.deleteMany({ where: { productId } });
        if (dto.eventIds.length) {
          await tx.productEvent.createMany({
            data: dto.eventIds.map((eventId) => ({
              productId,
              eventId,
            })),
          });
        }
      }

      // Replace FAQs if provided (bulk replace strategy)
      if (dto.faqs !== undefined) {
        await tx.productFaq.deleteMany({ where: { productId } });
        if (dto.faqs.length) {
          await tx.productFaq.createMany({
            data: dto.faqs.map((faq, i) => ({
              tenantId,
              productId,
              question: faq.question,
              answer: faq.answer,
              sequence: i,
            })),
          });
        }
      }

      // Replace detail headers + entries if provided (bulk replace strategy)
      if (dto.details !== undefined) {
        // Delete existing headers (entries cascade via DB)
        await tx.productDetailHeader.deleteMany({ where: { productId } });
        if (dto.details.length) {
          for (let i = 0; i < dto.details.length; i++) {
            const detail = dto.details[i];
            const header = await tx.productDetailHeader.create({
              data: {
                tenantId,
                productId,
                headerName: detail.headerName,
                sequence: detail.sequence ?? i,
              },
            });
            if (detail.entries?.length) {
              await tx.productDetailEntry.createMany({
                data: detail.entries.map((entry, j) => ({
                  headerId: header.id,
                  key: entry.key,
                  value: entry.value,
                  sequence: j,
                })),
              });
            }
          }
        }
      }

      // Emit update event
      this.eventEmitter.emit('product.updated', {
        tenantId,
        productId,
      });

      return updated;
    });
  }

  // =========================================================================
  // PRODUCT CONTENT
  // =========================================================================

  async addFaq(tenantId: string, productId: string, dto: CreateFaqDto) {
    await this.findProductOrFail(tenantId, productId);
    const maxSequence = await this.prisma.productFaq.aggregate({
      where: { productId, tenantId },
      _max: { sequence: true },
    });
    return this.prisma.productFaq.create({
      data: {
        tenantId,
        productId,
        question: dto.question,
        answer: dto.answer,
        sequence: (maxSequence._max.sequence ?? -1) + 1,
      },
    });
  }

  async updateFaq(
    tenantId: string,
    productId: string,
    faqId: string,
    dto: UpdateFaqDto,
  ) {
    const faq = await this.prisma.productFaq.findFirst({
      where: {
        id: faqId,
        productId,
        tenantId,
        product: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!faq) throw new NotFoundException('FAQ not found');
    return this.prisma.productFaq.update({ where: { id: faq.id }, data: dto });
  }

  async deleteFaq(tenantId: string, productId: string, faqId: string) {
    const faq = await this.prisma.productFaq.findFirst({
      where: {
        id: faqId,
        productId,
        tenantId,
        product: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!faq) throw new NotFoundException('FAQ not found');
    await this.prisma.productFaq.delete({ where: { id: faq.id } });
    return { message: 'FAQ deleted' };
  }

  async addDetailHeader(
    tenantId: string,
    productId: string,
    dto: CreateDetailHeaderDto,
  ) {
    await this.findProductOrFail(tenantId, productId);
    return this.prisma.$transaction(async (tx) => {
      const header = await tx.productDetailHeader.create({
        data: {
          tenantId,
          productId,
          headerName: dto.headerName,
          sequence: dto.sequence ?? 0,
        },
      });
      if (dto.entries?.length) {
        await tx.productDetailEntry.createMany({
          data: dto.entries.map((entry, sequence) => ({
            headerId: header.id,
            key: entry.key,
            value: entry.value,
            sequence,
          })),
        });
      }
      return tx.productDetailHeader.findUniqueOrThrow({
        where: { id: header.id },
        include: { entries: { orderBy: { sequence: 'asc' } } },
      });
    });
  }

  async updateDetailHeader(
    tenantId: string,
    productId: string,
    headerId: string,
    dto: UpdateDetailHeaderDto,
  ) {
    const header = await this.findDetailHeaderOrFail(tenantId, productId, headerId);
    return this.prisma.productDetailHeader.update({ where: { id: header.id }, data: dto });
  }

  async deleteDetailHeader(tenantId: string, productId: string, headerId: string) {
    const header = await this.findDetailHeaderOrFail(tenantId, productId, headerId);
    await this.prisma.productDetailHeader.delete({ where: { id: header.id } });
    return { message: 'Detail header deleted' };
  }

  async addDetailEntry(
    tenantId: string,
    productId: string,
    headerId: string,
    dto: DetailEntryDto,
  ) {
    await this.findDetailHeaderOrFail(tenantId, productId, headerId);
    const maxSequence = await this.prisma.productDetailEntry.aggregate({
      where: { headerId },
      _max: { sequence: true },
    });
    return this.prisma.productDetailEntry.create({
      data: {
        headerId,
        key: dto.key,
        value: dto.value,
        sequence: (maxSequence._max.sequence ?? -1) + 1,
      },
    });
  }

  async deleteDetailEntry(
    tenantId: string,
    productId: string,
    headerId: string,
    entryId: string,
  ) {
    const entry = await this.prisma.productDetailEntry.findFirst({
      where: {
        id: entryId,
        headerId,
        header: {
          productId,
          tenantId,
          product: { deletedAt: null },
        },
      },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Detail entry not found');
    await this.prisma.productDetailEntry.delete({ where: { id: entry.id } });
    return { message: 'Detail entry deleted' };
  }

  // =========================================================================
  // STATUS UPDATE
  // =========================================================================

  async updateStatus(tenantId: string, productId: string, status: ProductStatus) {
    const product = await this.findProductOrFail(tenantId, productId);

    if (status === 'published') {
      await this.assertPublishReady(tenantId, productId);
      const onboarding = await this.prisma.productOnboarding.findFirst({
        where: { tenantId, productId },
        select: { completedSections: true },
      });
      if (onboarding && !onboarding.completedSections.includes('REVIEW')) {
        throw new ConflictException({
          code: 'PRODUCT_ONBOARDING_INCOMPLETE',
          section: 'REVIEW',
          message: 'Complete and publish this product through its onboarding workflow.',
        });
      }
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status },
    });

    if (status === 'published' && product.status !== 'published') {
      this.eventEmitter.emit('product.published', { tenantId, productId });
    }

    return updated;
  }

  // =========================================================================
  // SOFT DELETE / RESTORE / PERMANENT DELETE
  // =========================================================================

  /**
   * Soft-delete a product: marks it as deleted + archived.
   * Guards: will refuse if there are any active or future-scheduled bookings.
   */
  async softDelete(tenantId: string, productId: string, deletedByUserId?: string) {
    // First check if it's already in trash (gives a better error than "not found")
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!existing) throw new NotFoundException('Product not found');
    if (existing.deletedAt !== null) {
      throw new BadRequestException('Product is already in trash');
    }

    // --- Business Rule: block deletion if there are active bookings ---
    const [activeBookings, futureBookings, publishedBundleUses] = await Promise.all([
      // Active bookings: currently in-flight
      this.prisma.bookingItem.count({
        where: {
          productId,
          tenantId,
          booking: {
            status: { in: ['pending', 'confirmed', 'delivered', 'overdue'] },
          },
        },
      }),
      // Future bookings: scheduled but not yet started (and not cancelled/completed)
      this.prisma.bookingItem.count({
        where: {
          productId,
          tenantId,
          startDate: { gt: new Date() },
          booking: {
            status: { notIn: ['cancelled', 'completed', 'returned', 'inspected'] },
          },
        },
      }),
      this.prisma.productCompositionRule.count({
        where: {
          tenantId,
          componentProductId: productId,
          isActive: true,
          parentProduct: { status: 'published', deletedAt: null },
        },
      }),
    ]);

    if (activeBookings > 0 || futureBookings > 0 || publishedBundleUses > 0) {
      const parts: string[] = [];
      if (activeBookings > 0) parts.push(`${activeBookings} active booking(s)`);
      if (futureBookings > 0) parts.push(`${futureBookings} future booking(s)`);
      if (publishedBundleUses > 0) parts.push(`${publishedBundleUses} published bundle(s)`);
      throw new UnprocessableEntityException(
        `Cannot move to trash: this product has ${parts.join(' and ')}. ` +
        `Resolve or cancel all associated bookings before deleting.`,
      );
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        status: 'archived',
        ...(deletedByUserId ? { deletedByUserId } : {}),
      },
    });

    this.eventEmitter.emit('product.deleted', { tenantId, productId });
    return updated;
  }

  /**
   * Restore a product from trash. Resets to draft so owner can review before re-publishing.
   */
  async restore(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: { not: null } },
    });
    if (!product) throw new NotFoundException('Product not found in trash');

    const restored = await this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: null, status: 'draft', deletedByUserId: null },
    });

    this.eventEmitter.emit('product.restored', { tenantId, productId });
    return restored;
  }

  /**
   * Permanently delete a product from trash.
   * Guards: will refuse if there are any active bookings still referencing it.
   */
  async permanentDelete(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: { not: null } },
    });
    if (!product) throw new NotFoundException('Product not found in trash');

    await this.prisma.$transaction(async (tx) => {
      const dependencyCounts = await Promise.all([
        tx.bookingItem.count({ where: { tenantId, productId } }),
        tx.fulfillmentRequirement.count({ where: { tenantId, productId } }),
        tx.inventoryReservation.count({ where: { tenantId, productId } }),
        tx.stockUnit.count({ where: { tenantId, variantSize: { variant: { productId } } } }),
        tx.inventoryMovement.count({ where: { tenantId, variantSize: { variant: { productId } } } }),
        tx.inventoryBlock.count({
          where: {
            tenantId,
            OR: [
              { productId },
              { variant: { productId } },
              { variantSize: { variant: { productId } } },
            ],
          },
        }),
        tx.productCompositionRule.count({
          where: { tenantId, OR: [{ parentProductId: productId }, { componentProductId: productId }] },
        }),
        tx.productCompositionAlternative.count({ where: { tenantId, productId } }),
        tx.quote.count({ where: { tenantId, productId } }),
        tx.review.count({ where: { tenantId, productId } }),
      ]);
      if (dependencyCounts.some((count) => count > 0)) {
        throw new ConflictException({
          code: 'PRODUCT_HISTORY_CONFLICT',
          message: 'Only products that have never entered inventory, rental, pricing quote, composition, or review history can be permanently deleted.',
        });
      }
      await tx.product.delete({ where: { id: productId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { message: 'Product permanently deleted' };
  }

  // =========================================================================
  // READ — GUEST
  // =========================================================================

  async listGuest(tenantId: string, query: ProductQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where = this.buildGuestWhere(tenantId, query);
    const orderBy = this.buildOrderBy(query.sort, query.order);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.productCardIncludes(),
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.mapProductCard(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getBySlug(tenantId: string, slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        slug,
        status: 'published',
        deletedAt: null,
      },
      include: this.fullProductIncludes(),
    });

    if (!product) throw new NotFoundException('Product not found');
    return this.mapProductDetail(product);
  }

  // =========================================================================
  // READ — GUEST STOREFRONT SHOWCASE (Landing Page APIs)
  // =========================================================================

  /**
   * Latest arrivals — most recently published products.
   * Simple indexed query on (tenant_id, status) + ORDER BY created_at DESC.
   */
  async getLatestArrivals(tenantId: string, limit = 12) {
    const take = Math.min(limit, 50);

    const products = await this.prisma.product.findMany({
      where: { tenantId, status: 'published', isAvailable: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      include: this.productCardIncludes(),
    });

    return {
      data: products.map((p) => this.mapProductCard(p)),
      meta: { limit: take },
    };
  }

  /**
   * Popular products — ranked by materialized popularity_score.
   * Fallback chain: popularityScore DESC → totalBookings DESC → createdAt DESC.
   * Ensures results even for brand new stores with zero analytics.
   */
  async getPopularProducts(tenantId: string, limit = 12) {
    const take = Math.min(limit, 50);

    const products = await this.prisma.product.findMany({
      where: { tenantId, status: 'published', isAvailable: true, deletedAt: null },
      orderBy: [
        { popularityScore: 'desc' },
        { totalBookings: 'desc' },
        { createdAt: 'desc' },
      ],
      take,
      include: this.productCardIncludes(),
    });

    return {
      data: products.map((p) => this.mapProductCard(p)),
      meta: { limit: take },
    };
  }

  /**
   * Popular products filtered by a specific category.
   * If no slug provided, auto-detects the most popular category.
   */
  async getPopularByCategory(tenantId: string, slug?: string, limit = 8) {
    const take = Math.min(limit, 50);

    // Resolve category — provided slug or auto-detect most popular
    let category: { id: string; name: string; slug: string } | null = null;

    if (slug) {
      category = await this.prisma.category.findFirst({
        where: { tenantId, slug, isActive: true },
        select: { id: true, name: true, slug: true },
      });
      if (!category) throw new NotFoundException('Category not found');
    } else {
      // Auto-detect: category with highest aggregate popularity_score
      const grouped = await this.prisma.product.groupBy({
        by: ['categoryId'],
        where: {
          tenantId,
          status: 'published',
          isAvailable: true,
          deletedAt: null,
        },
        _sum: { popularityScore: true },
        _count: { id: true },
        orderBy: [
          { _sum: { popularityScore: 'desc' } },
          { _count: { id: 'desc' } },
        ],
        take: 1,
      });
      if (grouped[0]?.categoryId) {
        category = await this.prisma.category.findUnique({
          where: { id: grouped[0].categoryId },
          select: { id: true, name: true, slug: true },
        });
      }
    }

    if (!category) {
      return { category: null, data: [], meta: { limit: take } };
    }

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        categoryId: category.id,
        status: 'published',
        isAvailable: true,
        deletedAt: null,
      },
      orderBy: [
        { popularityScore: 'desc' },
        { totalBookings: 'desc' },
        { createdAt: 'desc' },
      ],
      take,
      include: this.productCardIncludes(),
    });

    return {
      category: { slug: category.slug, name: category.name },
      data: products.map((p) => this.mapProductCard(p)),
      meta: { limit: take },
    };
  }

  /**
   * Popular products filtered by a specific subcategory.
   * If no slug provided, auto-detects the most popular subcategory.
   */
  async getPopularBySubcategory(tenantId: string, slug?: string, limit = 8) {
    const take = Math.min(limit, 50);

    let subcategory: { id: string; name: string; slug: string; category: { slug: string; name: string } } | null = null;

    if (slug) {
      subcategory = await this.prisma.subcategory.findFirst({
        where: { tenantId, slug, isActive: true },
        select: {
          id: true, name: true, slug: true,
          category: { select: { slug: true, name: true } },
        },
      });
      if (!subcategory) throw new NotFoundException('Subcategory not found');
    } else {
      // Auto-detect: subcategory with highest aggregate popularity_score
      const grouped = await this.prisma.product.groupBy({
        by: ['subcategoryId'],
        where: {
          tenantId,
          status: 'published',
          isAvailable: true,
          deletedAt: null,
        },
        _sum: { popularityScore: true },
        _count: { id: true },
        orderBy: [
          { _sum: { popularityScore: 'desc' } },
          { _count: { id: 'desc' } },
        ],
        take: 1,
      });
      if (grouped[0]?.subcategoryId) {
        const found = await this.prisma.subcategory.findUnique({
          where: { id: grouped[0].subcategoryId },
          select: {
            id: true, name: true, slug: true,
            category: { select: { slug: true, name: true } },
          },
        });
        if (found) subcategory = found;
      }
    }

    if (!subcategory) {
      return { subcategory: null, data: [], meta: { limit: take } };
    }

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        subcategoryId: subcategory.id,
        status: 'published',
        isAvailable: true,
        deletedAt: null,
      },
      orderBy: [
        { popularityScore: 'desc' },
        { totalBookings: 'desc' },
        { createdAt: 'desc' },
      ],
      take,
      include: this.productCardIncludes(),
    });

    return {
      subcategory: {
        slug: subcategory.slug,
        name: subcategory.name,
        category: subcategory.category,
      },
      data: products.map((p) => this.mapProductCard(p)),
      meta: { limit: take },
    };
  }

  /**
   * Popular products filtered by a specific event.
   * If no slug provided, auto-detects the most popular event.
   */
  async getPopularByEvent(tenantId: string, slug?: string, limit = 8) {
    const take = Math.min(limit, 50);

    let event: { id: string; name: string; slug: string } | null = null;

    if (slug) {
      event = await this.prisma.event.findFirst({
        where: { tenantId, slug, isActive: true },
        select: { id: true, name: true, slug: true },
      });
      if (!event) throw new NotFoundException('Event not found');
    } else {
      // Auto-detect: event with most popular products
      // Find the most popular product that has events, then use its top event
      const topProduct = await this.prisma.product.findFirst({
        where: {
          tenantId,
          status: 'published',
          isAvailable: true,
          deletedAt: null,
          events: { some: { event: { isActive: true } } },
        },
        orderBy: [{ popularityScore: 'desc' }, { totalBookings: 'desc' }],
        select: {
          events: {
            take: 1,
            select: { event: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
      event = topProduct?.events[0]?.event || null;
    }

    if (!event) {
      return { event: null, data: [], meta: { limit: take } };
    }

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        events: { some: { eventId: event.id } },
        status: 'published',
        isAvailable: true,
        deletedAt: null,
      },
      orderBy: [
        { popularityScore: 'desc' },
        { totalBookings: 'desc' },
        { createdAt: 'desc' },
      ],
      take,
      include: this.productCardIncludes(),
    });

    return {
      event: { slug: event.slug, name: event.name },
      data: products.map((p) => this.mapProductCard(p)),
      meta: { limit: take },
    };
  }

  // =========================================================================
  // READ — OWNER
  // =========================================================================

  async listOwner(tenantId: string, query: OwnerProductQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: query.status === 'trash' ? { not: null } : null,
    };
    const andFilters: Prisma.ProductWhereInput[] = [];

    if (query.status && query.status !== 'trash') {
      where.status = query.status;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.productTypeId) {
      where.productTypeId = query.productTypeId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { slug: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const readyWhere = this.ownerReadyWhere();
    if (query.readiness === 'ready') {
      andFilters.push(readyWhere);
    } else if (query.readiness === 'needs_attention') {
      andFilters.push({ NOT: readyWhere });
    }

    const hasStockWhere = this.ownerHasStockWhere();
    if (query.stockState === 'in_stock') {
      andFilters.push(hasStockWhere);
    } else if (query.stockState === 'no_stock') {
      andFilters.push({ NOT: hasStockWhere });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.ownerOrderBy(query),
        select: ownerProductListSelect(),
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => this.mapOwnerProductListItem(product)),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getById(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: this.fullProductIncludes(),
    });

    if (!product) throw new NotFoundException('Product not found');
    return this.mapOwnerProductDetail(product);
  }

  async getReadiness(tenantId: string, productId: string): Promise<ProductReadiness> {
    return this.getReadinessWithClient(this.prisma, tenantId, productId);
  }

  async getReadinessWithClient(
    db: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    productId: string,
  ): Promise<ProductReadiness> {
    const product = await db.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        category: { select: { isActive: true } },
        productType: {
          select: { defaultSizeSchema: { select: { id: true, status: true } } },
        },
        sizeSchemaOverride: { select: { id: true, status: true } },
        storefrontItemMode: true,
        pricingProfile: {
          select: {
            policyVersions: {
              where: { status: 'ACTIVE' },
              take: 1,
              select: { ratePlans: { take: 1, select: { id: true } } },
            },
          },
        },
        variants: {
          select: {
            id: true,
            variantName: true,
            images: { where: { isFeatured: true }, take: 1, select: { id: true } },
            sizes: {
              select: {
                id: true,
                sizeInstance: { select: { sizeSchemaId: true } },
              },
            },
          },
        },
        compositionRules: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            componentProduct: { select: { id: true, status: true, deletedAt: true } },
            alternatives: {
              where: { isActive: true },
              select: {
                id: true,
                product: { select: { id: true, status: true, deletedAt: true } },
              },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.evaluateProductReadiness({
      category: product.category,
      productType: product.productType,
      sizeSchemaOverride: product.sizeSchemaOverride,
      storefrontItemMode: product.storefrontItemMode,
      variants: product.variants,
      hasActivePricing: Boolean(product.pricingProfile?.policyVersions[0]?.ratePlans[0]),
      compositionRules: product.compositionRules,
    });
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async findProductOrFail(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.deletedAt !== null) {
      throw new BadRequestException(
        'This product is in the trash. Restore it before making changes.',
      );
    }
    return product;
  }

  private async findDetailHeaderOrFail(
    tenantId: string,
    productId: string,
    headerId: string,
  ) {
    const header = await this.prisma.productDetailHeader.findFirst({
      where: {
        id: headerId,
        productId,
        tenantId,
        product: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!header) throw new NotFoundException('Detail header not found');
    return header;
  }

  private async validateCatalogReferences(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: {
      categoryId: string;
      subcategoryId: string | null;
      productTypeId: string | null;
      sizeSchemaOverrideId: string | null;
      eventIds?: string[];
      storefrontItemMode: string;
    },
    productId?: string,
  ): Promise<void> {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'INVALID_CATALOG_REFERENCE',
        field: 'categoryId',
        message: 'Choose an active category from this store.',
      });
    }

    if (input.subcategoryId) {
      const subcategory = await tx.subcategory.findFirst({
        where: {
          id: input.subcategoryId,
          tenantId,
          categoryId: input.categoryId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!subcategory) {
        throw new BadRequestException({
          code: 'INVALID_CATALOG_REFERENCE',
          field: 'subcategoryId',
          message: 'Choose an active subcategory that belongs to the selected category.',
        });
      }
    }

    let defaultSizeSchemaId: string | null = null;
    if (input.productTypeId) {
      const productType = await tx.productType.findFirst({
        where: { id: input.productTypeId, tenantId },
        select: { defaultSizeSchemaId: true },
      });
      if (!productType) {
        throw new BadRequestException({
          code: 'INVALID_CATALOG_REFERENCE',
          field: 'productTypeId',
          message: 'Choose a product type from this store.',
        });
      }
      defaultSizeSchemaId = productType.defaultSizeSchemaId;
    }

    const activeSizeSchemaId = input.sizeSchemaOverrideId ?? defaultSizeSchemaId;
    if (activeSizeSchemaId) {
      const schema = await tx.sizeSchema.findFirst({
        where: { id: activeSizeSchemaId, tenantId, status: 'active' },
        select: { id: true },
      });
      if (!schema) {
        throw new BadRequestException({
          code: 'INVALID_CATALOG_REFERENCE',
          field: 'sizeSchemaOverrideId',
          message: 'Choose an active size schema from this store.',
        });
      }
    }

    if (input.eventIds !== undefined) {
      const uniqueEventIds = [...new Set(input.eventIds)];
      const eventCount = await tx.event.count({
        where: { id: { in: uniqueEventIds }, tenantId, isActive: true },
      });
      if (eventCount !== uniqueEventIds.length) {
        throw new BadRequestException({
          code: 'INVALID_CATALOG_REFERENCE',
          field: 'eventIds',
          message: 'One or more selected events are unavailable in this store.',
        });
      }
    }

    if (!productId) return;
    const variantSizes = await tx.variantSize.findMany({
      where: { tenantId, variant: { productId } },
      select: {
        id: true,
        sizeInstance: { select: { sizeSchemaId: true } },
      },
    });
    if (variantSizes.length > 0 && !activeSizeSchemaId) {
      throw new ConflictException({
        code: 'CATALOG_EDIT_CONFLICT',
        field: 'productTypeId',
        message: 'A product with configured SKUs must retain an active size schema.',
      });
    }
    if (
      activeSizeSchemaId &&
      variantSizes.some((size) => size.sizeInstance.sizeSchemaId !== activeSizeSchemaId)
    ) {
      throw new ConflictException({
        code: 'CATALOG_EDIT_CONFLICT',
        field: 'sizeSchemaOverrideId',
        message: 'The selected size schema does not contain the product’s existing SKUs.',
      });
    }
  }

  private async generateUniqueSlug(tenantId: string, name: string, excludeId?: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: {
          tenantId,
          slug,
          id: excludeId ? { not: excludeId } : undefined,
        },
      });
      if (!existing) break;
      slug = `${baseSlug}-${++counter}`;
    }

    return slug;
  }

  private ownerReadyWhere(): Prisma.ProductWhereInput {
    return {
      category: { is: { isActive: true } },
      productTypeId: { not: null },
      AND: [
        {
          OR: [
            { sizeSchemaOverride: { is: { status: 'active' } } },
            {
              sizeSchemaOverrideId: null,
              productType: { is: { defaultSizeSchema: { is: { status: 'active' } } } },
            },
          ],
        },
        { variants: { some: {} } },
        { variants: { none: { sizes: { none: {} } } } },
        { variants: { none: { images: { none: { isFeatured: true } } } } },
        {
          pricingProfile: {
            policyVersions: {
              some: { status: 'ACTIVE', ratePlans: { some: {} } },
            },
          },
        },
      ],
    };
  }

  private ownerHasStockWhere(): Prisma.ProductWhereInput {
    return {
      variants: {
        some: {
          sizes: {
            some: {
              stockUnits: {
                some: { disposition: 'ACTIVE', deletedAt: null },
              },
            },
          },
        },
      },
    };
  }

  private ownerOrderBy(
    query: OwnerProductQueryDto,
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (query.status === 'trash' && !query.sort) {
      return [{ deletedAt: 'desc' }, { id: 'asc' }];
    }

    const sort = query.sort ?? 'updatedAt';
    const direction = query.order ?? (sort === 'name' ? 'asc' : 'desc');
    return [
      { [sort]: direction } as Prisma.ProductOrderByWithRelationInput,
      { id: 'asc' },
    ];
  }

  private mapOwnerProductListItem(product: OwnerProductListRecord) {
    let physicalItems = 0;
    let skuCount = 0;
    let thumbnailUrl: string | null = null;

    for (const variant of product.variants) {
      thumbnailUrl ??= variant.images[0]?.thumbnailUrl || variant.images[0]?.url || null;
      for (const size of variant.sizes) {
        skuCount += 1;
        physicalItems += size._count.stockUnits;
      }
    }

    const activeRatePlan = product.pricingProfile?.policyVersions[0]?.ratePlans[0] ?? null;
    const readiness = this.evaluateProductReadiness({
      category: product.category,
      productType: product.productType,
      sizeSchemaOverride: product.sizeSchemaOverride,
      storefrontItemMode: product.storefrontItemMode,
      variants: product.variants,
      hasActivePricing: Boolean(activeRatePlan),
      compositionRules: product.compositionRules,
    });
    const onHand = physicalItems;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      totalBookings: product.totalBookings,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
      deletedBy: product.deletedBy,
      category: product.category,
      productType: product.productType,
      rentalPrice: product.pricingProfile?.headlinePriceMinor ?? 0,
      headlineLabel: product.pricingProfile?.headlineLabel ?? null,
      pricingMode: activeRatePlan?.type ?? null,
      thumbnailUrl,
      variantCount: product.variants.length,
      skuCount,
      inventory: {
        onHand,
        physicalItems,
        hasStock: onHand > 0,
      },
      readiness,
      onboarding: product.onboarding,
      _count: product._count,
    };
  }

  private evaluateProductReadiness(input: {
    category: { isActive: boolean } | null;
    productType: { defaultSizeSchema: { id: string; status: string } | null } | null;
    sizeSchemaOverride: { id: string; status: string } | null;
    storefrontItemMode: string;
    variants: Array<{
      id: string;
      variantName?: string | null;
      images: Array<{ id: string }>;
      sizes: Array<{
        id?: string;
        sizeInstance?: { sizeSchemaId: string };
      }>;
    }>;
    hasActivePricing: boolean;
    compositionRules: Array<{
      id: string;
      name: string;
      componentProduct: { id: string; status: ProductStatus; deletedAt: Date | null } | null;
      alternatives: Array<{
        id: string;
        product: { id: string; status: ProductStatus; deletedAt: Date | null };
      }>;
    }>;
  }): ProductReadiness {
    const blockers: ProductReadinessBlocker[] = [];
    const block = (
      code: ProductReadinessCode,
      section: ProductReadinessSection,
      message: string,
      field?: string,
      entityId?: string,
    ) => blockers.push({ code, section, message, ...(field ? { field } : {}), ...(entityId ? { entityId } : {}) });

    if (!input.category?.isActive) {
      block('CATEGORY', 'basic', 'Choose an active category.', 'categoryId');
    }
    if (!input.productType) {
      block('PRODUCT_TYPE', 'sizing', 'Choose a product type.', 'productTypeId');
    }

    const activeSchema = input.sizeSchemaOverride ?? input.productType?.defaultSizeSchema ?? null;
    if (!activeSchema || activeSchema.status !== 'active') {
      block('SIZE_SCHEMA', 'sizing', 'Choose an active size schema.', 'sizeSchemaOverrideId');
    }
    if (input.variants.length === 0) {
      block('VARIANT', 'variants', 'Add at least one product variant.', 'variants');
    }

    for (const variant of input.variants) {
      if (variant.sizes.length === 0) {
        block('RENTABLE_SKU', 'variants', 'Add at least one rentable size to this variant.', 'variants', variant.id);
      }
      if (!variant.images.some(Boolean)) {
        block('VARIANT_MEDIA', 'variants', 'Add a featured image to this variant.', 'variants', variant.id);
      }
      if (
        activeSchema &&
        variant.sizes.some((size) => size.sizeInstance && size.sizeInstance.sizeSchemaId !== activeSchema.id)
      ) {
        block('SIZE_SCHEMA', 'sizing', 'A variant uses a size outside the selected size schema.', 'sizeSchemaOverrideId', variant.id);
      }
    }

    if (!input.hasActivePricing) {
      block('ACTIVE_PRICING', 'pricing', 'Configure and activate a rental pricing policy.', 'ratePlanType');
    }

    for (const rule of input.compositionRules) {
      if (
        !rule.componentProduct ||
        rule.componentProduct.deletedAt ||
        rule.componentProduct.status !== ProductStatus.published
      ) {
        block('COMPOSITION', 'composition', `Composition rule “${rule.name}” needs a published component product.`, undefined, rule.id);
      }
      if (
        rule.alternatives.some(
          (alternative) => alternative.product.deletedAt || alternative.product.status !== ProductStatus.published,
        )
      ) {
        block('COMPOSITION', 'composition', `Composition rule “${rule.name}” contains an unavailable alternative.`, undefined, rule.id);
      }
    }

    return { ready: blockers.length === 0, blockers };
  }

  private buildGuestWhere(tenantId: string, query: ProductQueryDto): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      status: 'published',
      isAvailable: true,
      deletedAt: null,
    };

    if (query.category) {
      where.category = { slug: query.category };
    }
    if (query.subcategory) {
      where.subcategory = { slug: query.subcategory };
    }
    if (query.event) {
      where.events = {
        some: { event: { slug: query.event } },
      };
    }
    if (query.color) {
      where.variants = {
        some: {
          OR: [
            { mainColor: { name: { equals: query.color, mode: 'insensitive' } } },
            { identicalColors: { some: { color: { name: { equals: query.color, mode: 'insensitive' } } } } },
          ],
        },
      };
    }
    if (query.minPrice || query.maxPrice) {
      where.pricingProfile = {
        headlinePriceMinor: {
          ...(query.minPrice ? { gte: query.minPrice } : {}),
          ...(query.maxPrice ? { lte: query.maxPrice } : {}),
        },
      };
    }

    return where;
  }

  private buildOrderBy(sort?: string, order?: string): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
    const direction = order === 'asc' ? 'asc' : 'desc';

    switch (sort) {
      case 'price_asc':
        return { pricingProfile: { headlinePriceMinor: 'asc' } };
      case 'price_desc':
        return { pricingProfile: { headlinePriceMinor: 'desc' } };
      case 'popularity':
        return [
          { popularityScore: 'desc' },
          { totalBookings: 'desc' },
          { createdAt: 'desc' },
        ];
      case 'newest':
        return { createdAt: 'desc' };
      default:
        return { createdAt: direction as Prisma.SortOrder };
    }
  }

  /**
   * Lightweight includes for product card rendering (listing pages, showcases).
   * Reused by listGuest(), getLatestArrivals(), getPopular*(), etc.
   */
  private productCardIncludes() {
    return {
      category: { select: { id: true, name: true, slug: true, isActive: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      events: {
        include: { event: { select: { id: true, name: true } } },
      },
      pricingProfile: {
        include: {
          policyVersions: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              ratePlans: {
                orderBy: { priority: 'desc' },
                take: 1
              },
              priceComponents: true,
            }
          }
        }
      },
      variants: {
        orderBy: { sequence: 'asc' as const },
        take: 1,
        include: {
          mainColor: { select: { id: true, name: true, hexCode: true } },
          images: {
            where: { isFeatured: true },
            take: 1,
            select: { url: true, thumbnailUrl: true },
          },
        },
      },
      _count: { select: { variants: true } },
    } as const;
  }

  private fullProductIncludes() {
    return {
      onboarding: {
        select: { currentSection: true, completedSections: true, revision: true, updatedAt: true },
      },
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      events: {
        include: { event: { select: { id: true, name: true, slug: true } } },
      },
      pricingProfile: {
        include: {
          policyVersions: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              ratePlans: true,
              priceComponents: true
            }
          }
        }
      },
      productType: {
        include: {
          defaultSizeSchema: {
            include: {
              instances: { orderBy: { sortOrder: 'asc' as const } },
              sizeCharts: {
                include: { rows: { orderBy: { sortOrder: 'asc' as const } } },
              },
            },
          },
        },
      },
      sizeSchemaOverride: {
        include: {
          instances: { orderBy: { sortOrder: 'asc' as const } },
          sizeCharts: {
            include: { rows: { orderBy: { sortOrder: 'asc' as const } } },
          },
        },
      },
      variants: {
        orderBy: { sequence: 'asc' as const },
        include: {
          mainColor: { select: { id: true, name: true, hexCode: true } },
          identicalColors: {
            include: {
              color: { select: { id: true, name: true, hexCode: true } },
            },
          },
          sizes: {
            include: {
              sizeInstance: true,
              _count: {
                select: {
                  stockUnits: {
                    where: { disposition: 'ACTIVE', deletedAt: null },
                  },
                },
              },
            },
          },
          images: {
            orderBy: { sequence: 'asc' as const },
          },
        },
      },
      faqs: {
        orderBy: { sequence: 'asc' as const },
      },
      detailHeaders: {
        orderBy: { sequence: 'asc' as const },
        include: {
          entries: {
            orderBy: { sequence: 'asc' as const },
          },
        },
      },
      compositionRules: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          componentProduct: { select: { id: true, status: true, deletedAt: true } },
          alternatives: {
            where: { isActive: true },
            select: {
              id: true,
              product: { select: { id: true, status: true, deletedAt: true } },
            },
          },
        },
      },
    } as const;
  }

  private computeHeadlinePrice(product: any): { price: number; label: string; mode: string } | null {
    const activeVersion = product.pricingProfile?.policyVersions?.[0];
    const ratePlan = activeVersion?.ratePlans?.[0];
    if (!product.pricingProfile || !ratePlan) return null;
    return {
      price: product.pricingProfile.headlinePriceMinor,
      label: product.pricingProfile.headlineLabel ?? '',
      mode: ratePlan.type,
    };
  }

  private mapProductCard(product: any) {
    const defaultVariant = product.variants?.[0];
    const featuredImage = defaultVariant?.images?.[0];

    const headline = this.computeHeadlinePrice(product);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      subcategory: product.subcategory,
      events: product.events?.map((pe: any) => pe.event) || [],
      rentalPrice: headline?.price || 0,
      pricingMode: headline?.mode || null,
      priceLabel: headline?.label || null,
      includedDays:
        product.pricingProfile?.policyVersions?.[0]?.ratePlans?.[0]?.type === 'FLAT_PERIOD'
          ? Number(
              product.pricingProfile.policyVersions[0].ratePlans[0].config?.includedDays ?? 0,
            ) || null
          : null,
      depositAmount: this.computeDeposit(product),
      isAvailable: product.isAvailable,
      totalBookings: product.totalBookings,
      defaultVariant: defaultVariant
        ? {
            id: defaultVariant.id,
            mainColor: defaultVariant.mainColor,
            featuredImage: featuredImage || null,
          }
        : null,
      variantCount: product._count?.variants || 0,
    };
  }

  private computeDeposit(product: any): number {
    const activeVersion = product.pricingProfile?.policyVersions?.[0];
    if (activeVersion && activeVersion.priceComponents?.length > 0) {
      const depositComponent = activeVersion.priceComponents.find((c: any) => c.type === 'DEPOSIT');
      if (depositComponent && depositComponent.config?.pricing?.mode === 'FLAT') {
        return depositComponent.config.pricing.amountMinor;
      }
    }
    return 0;
  }

  private mapProductDetail(product: any) {
    // Resolve active schema: product override → product type default
    const activeSchema = product.sizeSchemaOverride ?? product.productType?.defaultSizeSchema ?? null;

    return {
      ...product,
      events: product.events?.map((pe: any) => pe.event) || [],
      variants: product.variants?.map((v: any) => ({
        ...v,
        identicalColors: v.identicalColors?.map((vc: any) => vc.color) || [],
        sizes: v.sizes?.map((s: any) => ({
          variantSizeId: s.id,
          sizeInstance: s.sizeInstance,
          totalCapacity: s._count?.stockUnits ?? 0,
        })) || [],
      })),
      details: product.detailHeaders?.map((h: any) => ({
        id: h.id,
        header: h.headerName,
        entries: h.entries || [],
      })),
      // Resolved sizing payload
      sizing: activeSchema ? {
        schema: {
          id: activeSchema.id,
          code: activeSchema.code,
          name: activeSchema.name,
          definition: activeSchema.definition,
        },
        instances: activeSchema.instances || [],
        sizeCharts: activeSchema.sizeCharts || [],
      } : null,
      productType: product.productType ? {
        id: product.productType.id,
        name: product.productType.name,
        slug: product.productType.slug,
      } : null,
      pricing: this.mapActivePricing(product.pricingProfile),
      headlinePricing: this.computeHeadlinePrice(product),
    };
  }

  private mapOwnerProductDetail(product: any) {
    const activeSchema = product.sizeSchemaOverride ?? product.productType?.defaultSizeSchema ?? null;
    const readiness = this.evaluateProductReadiness({
      category: product.category,
      productType: product.productType,
      sizeSchemaOverride: product.sizeSchemaOverride,
      storefrontItemMode: product.storefrontItemMode,
      variants: product.variants,
      hasActivePricing: Boolean(product.pricingProfile?.policyVersions?.[0]?.ratePlans?.[0]),
      compositionRules: product.compositionRules ?? [],
    });
    return {
      ...product,
      readiness,
      pricing: this.mapActivePricing(product.pricingProfile),
      sizing: activeSchema
        ? {
            schema: {
              id: activeSchema.id,
              code: activeSchema.code,
              name: activeSchema.name,
              schemaType: activeSchema.schemaType,
              definition: activeSchema.definition,
            },
            instances: activeSchema.instances || [],
            sizeCharts: activeSchema.sizeCharts || [],
          }
        : null,
    };
  }

  private mapActivePricing(profile: any) {
    const version = profile?.policyVersions?.[0];
    const ratePlan = version?.ratePlans?.[0];
    if (!profile || !version || !ratePlan) return null;
    const delivery = version.priceComponents?.find(
      (component: any) => component.type === 'FEE' && component.config?.purpose === 'DELIVERY',
    );
    return {
      profileId: profile.id,
      policyVersionId: version.id,
      currency: profile.currency,
      ratePlanType: ratePlan.type,
      ratePlanConfig: ratePlan.config,
      components: version.priceComponents,
      lateFeePolicy: version.lateFeePolicy,
      shippingMode: delivery ? 'flat' : 'free',
      shippingFee: delivery?.config?.pricing?.amountMinor ?? 0,
    };
  }

  private async assertPublishReady(tenantId: string, productId: string): Promise<void> {
    const readiness = await this.getReadiness(tenantId, productId);

    if (!readiness.ready) {
      throw new UnprocessableEntityException({
        code: 'PRODUCT_NOT_READY_TO_PUBLISH',
        message: 'Product cannot be published until every catalog blocker is resolved.',
        blockers: readiness.blockers,
      });
    }
  }

}
