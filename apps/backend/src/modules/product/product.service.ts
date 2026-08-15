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
import { ProductQueryDto, OwnerProductQueryDto } from './dto/product.dto';
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
  // STATUS UPDATE
  // =========================================================================

  async updateStatus(
    tenantId: string,
    productId: string,
    status: 'draft' | 'archived',
    actorUserId: string,
  ) {
    const product = await this.findProductOrFail(tenantId, productId);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status },
    });

    if (status !== product.status) {
      this.eventEmitter.emit('product.statusChanged', {
        tenantId,
        productId,
        userId: actorUserId,
        previousStatus: product.status,
        status,
      });
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

    this.eventEmitter.emit('product.deleted', {
      tenantId,
      productId,
      userId: deletedByUserId,
    });
    return updated;
  }

  /**
   * Restore a product from trash. Resets to draft so owner can review before re-publishing.
   */
  async restore(tenantId: string, productId: string, actorUserId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: { not: null } },
    });
    if (!product) throw new NotFoundException('Product not found in trash');

    const restored = await this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: null, status: 'draft', deletedByUserId: null },
    });

    this.eventEmitter.emit('product.restored', { tenantId, productId, userId: actorUserId });
    return restored;
  }

  /**
   * Permanently delete a product from trash.
   * Guards: will refuse if there are any active bookings still referencing it.
   */
  async permanentDelete(tenantId: string, productId: string, actorUserId: string) {
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

    this.eventEmitter.emit('product.permanentlyDeleted', {
      tenantId,
      productId,
      userId: actorUserId,
      name: product.name,
    });

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
      category: { select: { id: true, name: true, slug: true, isActive: true } },
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

}
