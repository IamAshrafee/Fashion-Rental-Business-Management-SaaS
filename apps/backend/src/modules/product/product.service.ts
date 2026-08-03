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
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  OwnerProductQueryDto,
} from './dto/product.dto';
import { InventoryTrackingMode, Prisma } from '@prisma/client';

const ownerProductListSelect = () => ({
  id: true,
  name: true,
  slug: true,
  status: true,
  targetRentals: true,
  totalBookings: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  productType: { select: { id: true, name: true, slug: true } },
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
      mainColor: { select: { name: true, hexCode: true } },
      images: {
        where: { isFeatured: true },
        orderBy: { sequence: 'asc' as const },
        take: 1,
        select: { id: true, url: true, thumbnailUrl: true, isFeatured: true },
      },
      sizes: {
        select: {
          trackingMode: true,
          inventoryPools: { select: { onHandQuantity: true } },
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
  // CREATE
  // =========================================================================

  async create(tenantId: string, dto: CreateProductDto, idempotencyKey?: string) {
    const creationKey = idempotencyKey?.trim() || null;
    if (creationKey && creationKey.length > 128) {
      throw new BadRequestException('Idempotency-Key must be 128 characters or fewer');
    }

    if (creationKey) {
      const existing = await this.prisma.product.findFirst({
        where: { tenantId, creationKey },
      });
      if (existing) {
        this.assertMatchingCreationRequest(existing, dto);
        return existing;
      }
    }

    const slug = await this.generateUniqueSlug(tenantId, dto.name);

    try {
      return await this.prisma.$transaction(async (tx) => {
      // 1. Create product
      const product = await tx.product.create({
        data: {
          tenantId,
          creationKey,
          name: dto.name,
          slug,
          description: dto.description,
          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId || null,
          productTypeId: dto.productTypeId || null,
          sizeSchemaOverrideId: dto.sizeSchemaOverrideId || null,
          // Variants, images, pricing v2, and inventory are saved by subsequent
          // owner requests. A base product therefore always starts as a draft.
          status: 'draft',
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          purchasePrice: dto.purchasePrice ?? null,
          purchasePricePublic: dto.purchasePricePublic ?? false,
          itemCountry: dto.itemCountry ?? null,
          itemCountryPublic: dto.itemCountryPublic ?? false,
          targetRentals: dto.targetRentals ?? null,
          storefrontItemMode: dto.storefrontItemMode,
        },
      });

      // 2. Create event associations
      if (dto.eventIds?.length) {
        await tx.productEvent.createMany({
          data: dto.eventIds.map((eventId) => ({
            productId: product.id,
            eventId,
          })),
        });
      }

      // 3. Create FAQs
      if (dto.faqs?.length) {
        await tx.productFaq.createMany({
          data: dto.faqs.map((faq, i) => ({
            tenantId,
            productId: product.id,
            question: faq.question,
            answer: faq.answer,
            sequence: i,
          })),
        });
      }

      // 7. Create detail headers + entries
      if (dto.details?.length) {
        for (let i = 0; i < dto.details.length; i++) {
          const detail = dto.details[i];
          const header = await tx.productDetailHeader.create({
            data: {
              tenantId,
              productId: product.id,
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

        return product;
      });
    } catch (error) {
      if (creationKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.product.findFirst({
          where: { tenantId, creationKey },
        });
        if (existing) {
          this.assertMatchingCreationRequest(existing, dto);
          return existing;
        }
      }
      throw error;
    }
  }

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
    if (dto.subcategoryId !== undefined) data.subcategoryId = dto.subcategoryId;
    if (dto.purchaseDate !== undefined) data.purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate) : null;
    if (dto.purchasePrice !== undefined) data.purchasePrice = dto.purchasePrice;
    if (dto.purchasePricePublic !== undefined) data.purchasePricePublic = dto.purchasePricePublic;
    if (dto.itemCountry !== undefined) data.itemCountry = dto.itemCountry;
    if (dto.itemCountryPublic !== undefined) data.itemCountryPublic = dto.itemCountryPublic;
    if (dto.targetRentals !== undefined) data.targetRentals = dto.targetRentals;
    if (dto.storefrontItemMode !== undefined) data.storefrontItemMode = dto.storefrontItemMode;
    if (dto.productTypeId !== undefined) data.productTypeId = dto.productTypeId || null;
    if (dto.sizeSchemaOverrideId !== undefined) data.sizeSchemaOverrideId = dto.sizeSchemaOverrideId || null;

    return this.prisma.$transaction(async (tx) => {
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
  // STATUS UPDATE
  // =========================================================================

  async updateStatus(tenantId: string, productId: string, status: string) {
    const product = await this.findProductOrFail(tenantId, productId);

    if (status === 'published') {
      await this.assertPublishReady(tenantId, productId);
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: status as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ },
    });

    if (status === 'published' && product.status !== 'published') {
      this.eventEmitter.emit('product.created', { tenantId, productId });
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
    const [activeBookings, futureBookings] = await Promise.all([
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
    ]);

    if (activeBookings > 0 || futureBookings > 0) {
      const parts: string[] = [];
      if (activeBookings > 0) parts.push(`${activeBookings} active booking(s)`);
      if (futureBookings > 0) parts.push(`${futureBookings} future booking(s)`);
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

    // Check for active bookings — including overdue (item still not returned)
    const activeBookings = await this.prisma.bookingItem.count({
      where: {
        productId,
        tenantId,
        booking: {
          status: { in: ['pending', 'confirmed', 'delivered', 'overdue'] },
        },
      },
    });
    if (activeBookings > 0) {
      throw new UnprocessableEntityException(
        `Cannot permanently delete: product has ${activeBookings} active booking(s). ` +
        `These must be resolved first.`,
      );
    }

    // Use a transaction to clean up all non-cascaded FK references
    await this.prisma.$transaction(async (tx) => {
      // Nullify product reference on booking items (preserves booking history)
      await tx.bookingItem.updateMany({
        where: { productId },
        data: { productId: null },
      });

      // Delete reviews (no value once product is permanently gone)
      await tx.review.deleteMany({ where: { productId } });

      // Now delete the product; dependent catalog and inventory definitions cascade.
      await tx.product.delete({ where: { id: productId } });
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
    if (query.trackingMode) {
      where.variants = {
        some: { sizes: { some: { trackingMode: query.trackingMode } } },
      };
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

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private assertMatchingCreationRequest(
    product: { name: string; categoryId: string; productTypeId: string | null },
    dto: CreateProductDto,
  ): void {
    const matches =
      product.name === dto.name &&
      product.categoryId === dto.categoryId &&
      product.productTypeId === (dto.productTypeId || null);
    if (!matches) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This product creation key is already associated with another draft.',
      });
    }
  }

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
      productTypeId: { not: null },
      AND: [
        { variants: { some: { sizes: { some: {} } } } },
        { variants: { some: { images: { some: { isFeatured: true } } } } },
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
              OR: [
                { inventoryPools: { some: { onHandQuantity: { gt: 0 } } } },
                {
                  stockUnits: {
                    some: { disposition: 'ACTIVE', deletedAt: null },
                  },
                },
              ],
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
    let pooledOnHand = 0;
    let serializedUnits = 0;
    let skuCount = 0;
    let thumbnailUrl: string | null = null;
    const trackingModes = new Set<InventoryTrackingMode>();

    for (const variant of product.variants) {
      thumbnailUrl ??= variant.images[0]?.thumbnailUrl || variant.images[0]?.url || null;
      for (const size of variant.sizes) {
        skuCount += 1;
        trackingModes.add(size.trackingMode);
        if (size.trackingMode === InventoryTrackingMode.POOLED) {
          for (const pool of size.inventoryPools) {
            pooledOnHand += pool.onHandQuantity;
          }
        } else {
          serializedUnits += size._count.stockUnits;
        }
      }
    }

    const activeRatePlan = product.pricingProfile?.policyVersions[0]?.ratePlans[0] ?? null;
    const readiness = this.productReadiness({
      hasProductType: Boolean(product.productType),
      hasVariant: product.variants.length > 0,
      hasSku: skuCount > 0,
      hasFeaturedImage: Boolean(thumbnailUrl),
      hasActivePricing: Boolean(activeRatePlan),
    });
    const trackingMode =
      trackingModes.size === 0
        ? 'NONE'
        : trackingModes.size > 1
          ? 'MIXED'
          : (trackingModes.values().next().value ?? 'NONE');
    const onHand = pooledOnHand + serializedUnits;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      targetRentals: product.targetRentals,
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
      trackingMode,
      inventory: {
        onHand,
        pooledOnHand,
        serializedUnits,
        hasStock: onHand > 0,
      },
      readiness,
      _count: product._count,
    };
  }

  private productReadiness(input: {
    hasProductType: boolean;
    hasVariant: boolean;
    hasSku: boolean;
    hasFeaturedImage: boolean;
    hasActivePricing: boolean;
  }): { ready: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!input.hasProductType) missing.push('PRODUCT_TYPE');
    if (!input.hasVariant) missing.push('VARIANT');
    if (!input.hasSku) missing.push('RENTABLE_SKU');
    if (!input.hasFeaturedImage) missing.push('FEATURED_IMAGE');
    if (!input.hasActivePricing) missing.push('ACTIVE_PRICING');
    return { ready: missing.length === 0, missing };
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
      category: { select: { id: true, name: true, slug: true } },
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
              inventoryPools: {
                where: { location: { isActive: true } },
                select: { onHandQuantity: true },
              },
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
          trackingMode: s.trackingMode,
          totalCapacity:
            s.trackingMode === 'SERIALIZED'
              ? (s._count?.stockUnits ?? 0)
              : s.inventoryPools?.reduce(
                  (sum: number, pool: { onHandQuantity: number }) => sum + pool.onHandQuantity,
                  0,
                ) ?? 0,
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
    return {
      ...product,
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
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        categoryId: true,
        productTypeId: true,
        pricingProfile: {
          select: {
            policyVersions: {
              where: { status: 'ACTIVE' },
              take: 1,
              select: { id: true, ratePlans: { take: 1, select: { id: true } } },
            },
          },
        },
        variants: {
          select: {
            images: { where: { isFeatured: true }, take: 1, select: { id: true } },
            sizes: {
              select: { id: true },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const hasFeaturedImage = product.variants.some((variant) => variant.images.length > 0);
    const hasActivePricing = Boolean(
      product.pricingProfile?.policyVersions.some((version) => version.ratePlans.length > 0),
    );

    const readiness = this.productReadiness({
      hasProductType: Boolean(product.productTypeId),
      hasVariant: product.variants.length > 0,
      hasSku: product.variants.some((variant) => variant.sizes.length > 0),
      hasFeaturedImage,
      hasActivePricing,
    });

    if (!readiness.ready) {
      const labels: Record<string, string> = {
        PRODUCT_TYPE: 'product type',
        VARIANT: 'variant',
        RENTABLE_SKU: 'rentable SKU',
        FEATURED_IMAGE: 'featured image',
        ACTIVE_PRICING: 'active pricing',
      };
      const missingLabels = readiness.missing.map((code) => labels[code] ?? code);
      throw new UnprocessableEntityException({
        code: 'PRODUCT_NOT_READY_TO_PUBLISH',
        message: `Product cannot be published until it has: ${missingLabels.join(', ')}`,
        missing: readiness.missing,
      });
    }
  }

}
