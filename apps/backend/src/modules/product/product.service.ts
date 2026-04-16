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
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { Prisma } from '@prisma/client';

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

  async create(tenantId: string, dto: CreateProductDto) {
    const slug = await this.generateUniqueSlug(tenantId, dto.name);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create product
      const product = await tx.product.create({
        data: {
          tenantId,
          name: dto.name,
          slug,
          description: dto.description,
          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId || null,
          productTypeId: dto.productTypeId || null,
          sizeSchemaOverrideId: dto.sizeSchemaOverrideId || null,
          status: (dto.status as 'draft' | 'published') || 'draft',
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          purchasePrice: dto.purchasePrice ?? null,
          purchasePricePublic: dto.purchasePricePublic ?? false,
          itemCountry: dto.itemCountry ?? null,
          itemCountryPublic: dto.itemCountryPublic ?? false,
          targetRentals: dto.targetRentals ?? null,
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

      // 3. Create pricing
      if (dto.pricing) {
        const calculatedPrice = this.calculatePrice(dto.pricing);
        await tx.productPricing.create({
          data: {
            tenantId,
            productId: product.id,
            mode: dto.pricing.mode,
            rentalPrice: dto.pricing.rentalPrice ?? null,
            includedDays: dto.pricing.includedDays ?? null,
            pricePerDay: dto.pricing.pricePerDay ?? null,
            minimumDays: dto.pricing.minimumDays ?? null,
            retailPrice: dto.pricing.retailPrice ?? null,
            rentalPercentage: dto.pricing.rentalPercentage ?? null,
            calculatedPrice,
            priceOverride: dto.pricing.priceOverride ?? null,
            minInternalPrice: dto.pricing.minInternalPrice ?? null,
            maxDiscountPrice: dto.pricing.maxDiscountPrice ?? null,
            extendedRentalRate: dto.pricing.extendedRentalRate ?? null,
            lateFeeType: dto.pricing.lateFeeType as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ?? null,
            lateFeeAmount: dto.pricing.lateFeeAmount ?? null,
            lateFeePercentage: dto.pricing.lateFeePercentage ?? null,
            maxLateFee: dto.pricing.maxLateFee ?? null,
            shippingMode: dto.pricing.shippingMode as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ ?? null,
            shippingFee: dto.pricing.shippingFee ?? null,
          },
        });
      }

      // 4. Create services
      if (dto.services) {
        await tx.productServices.create({
          data: {
            tenantId,
            productId: product.id,
            depositAmount: dto.services.depositAmount ?? null,
            cleaningFee: dto.services.cleaningFee ?? null,
            backupSizeEnabled: dto.services.backupSizeEnabled ?? false,
            backupSizeFee: dto.services.backupSizeFee ?? null,
            tryOnEnabled: dto.services.tryOnEnabled ?? false,
            tryOnFee: dto.services.tryOnFee ?? null,
            tryOnDurationHours: dto.services.tryOnDurationHours ?? 24,
            tryOnCreditToRental: dto.services.tryOnCreditToRental ?? false,
          },
        });
      }

      // 5. Create FAQs
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

      // Update nested objects if provided
      if (dto.pricing) {
        await this.upsertPricing(tx, tenantId, productId, dto.pricing);
      }
      if (dto.services) {
        await this.upsertServices(tx, tenantId, productId, dto.services);
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

      // Delete date blocks (scheduling data, meaningless without the product)
      await tx.dateBlock.deleteMany({ where: { productId } });

      // Delete reviews (no value once product is permanently gone)
      await tx.review.deleteMany({ where: { productId } });

      // Now delete the product (variants, pricing, services, etc. cascade automatically)
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
        pages: Math.ceil(total / limit),
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

  async listOwner(tenantId: string, query: ProductQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: query.status === 'trash' ? { not: null } : null,
    };

    if (query.status && query.status !== 'trash') {
      where.status = query.status as any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
    }
    if (query.category) {
      where.category = { slug: query.category };
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: query.status === 'trash' ? { deletedAt: 'desc' } : { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          pricing: {
            select: {
              mode: true,
              rentalPrice: true,
              pricePerDay: true,
              calculatedPrice: true,
              priceOverride: true,
              minInternalPrice: true,
            },
          },
          variants: {
            orderBy: { sequence: 'asc' },
            take: 1,
            include: {
              mainColor: { select: { name: true, hexCode: true } },
              images: {
                where: { isFeatured: true },
                take: 1,
                select: { thumbnailUrl: true },
              },
            },
          },
          // Include who deleted the product (for trash view)
          deletedBy: { select: { id: true, fullName: true } },
          _count: { select: { variants: true, bookingItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getById(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: this.fullProductIncludes(),
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
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

  private calculatePrice(pricing: { mode: string; rentalPrice?: number; retailPrice?: number; rentalPercentage?: number }): number | null {
    if (pricing.mode === 'percentage' && pricing.retailPrice && pricing.rentalPercentage) {
      return Math.round(pricing.retailPrice * (pricing.rentalPercentage / 100));
    }
    return null;
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
      where.pricing = {};
      if (query.minPrice) {
        where.pricing.rentalPrice = { gte: query.minPrice };
      }
      if (query.maxPrice) {
        where.pricing.rentalPrice = {
          ...(where.pricing.rentalPrice as Record<string, number> || {}),
          lte: query.maxPrice,
        };
      }
    }

    return where;
  }

  private buildOrderBy(sort?: string, order?: string): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
    const direction = order === 'asc' ? 'asc' : 'desc';

    switch (sort) {
      case 'price_asc':
        return { pricing: { rentalPrice: 'asc' } };
      case 'price_desc':
        return { pricing: { rentalPrice: 'desc' } };
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
      pricing: {
        select: {
          mode: true,
          rentalPrice: true,
          includedDays: true,
          pricePerDay: true,
          calculatedPrice: true,
          priceOverride: true,
          shippingMode: true,
          shippingFee: true,
        },
      },
      services: {
        select: { depositAmount: true },
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
      pricing: true,
      services: true,
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
          sizes: { include: { sizeInstance: true } },
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

  private mapProductCard(product: any) {
    const p = product.pricing;
    const defaultVariant = product.variants?.[0];
    const featuredImage = defaultVariant?.images?.[0];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      subcategory: product.subcategory,
      events: product.events?.map((pe: any) => pe.event) || [],
      rentalPrice: this.getEffectivePrice(p),
      pricingMode: p?.mode || null,
      includedDays: p?.includedDays || null,
      depositAmount: product.services?.depositAmount || 0,
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

  private mapProductDetail(product: any) {
    // Resolve active schema: product override → product type default
    const activeSchema = product.sizeSchemaOverride ?? product.productType?.defaultSizeSchema ?? null;

    return {
      ...product,
      events: product.events?.map((pe: any) => pe.event) || [],
      variants: product.variants?.map((v: any) => ({
        ...v,
        identicalColors: v.identicalColors?.map((vc: any) => vc.color) || [],
        sizes: v.sizes?.map((s: any) => s.sizeInstance) || [],
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
    };
  }

  private getEffectivePrice(pricing: any): number | null {
    if (!pricing) return null;
    if (pricing.priceOverride) return pricing.priceOverride;
    if (pricing.mode === 'one_time') return pricing.rentalPrice;
    if (pricing.mode === 'per_day') return pricing.pricePerDay;
    if (pricing.mode === 'percentage') return pricing.calculatedPrice;
    return pricing.rentalPrice;
  }

  private async upsertPricing(tx: any, tenantId: string, productId: string, pricing: any) {
    const calculatedPrice = this.calculatePrice(pricing);
    await tx.productPricing.upsert({
      where: { productId },
      create: {
        tenantId,
        productId,
        mode: pricing.mode,
        rentalPrice: pricing.rentalPrice ?? null,
        includedDays: pricing.includedDays ?? null,
        pricePerDay: pricing.pricePerDay ?? null,
        minimumDays: pricing.minimumDays ?? null,
        retailPrice: pricing.retailPrice ?? null,
        rentalPercentage: pricing.rentalPercentage ?? null,
        calculatedPrice,
        priceOverride: pricing.priceOverride ?? null,
        minInternalPrice: pricing.minInternalPrice ?? null,
        maxDiscountPrice: pricing.maxDiscountPrice ?? null,
        extendedRentalRate: pricing.extendedRentalRate ?? null,
        lateFeeType: pricing.lateFeeType ?? null,
        lateFeeAmount: pricing.lateFeeAmount ?? null,
        lateFeePercentage: pricing.lateFeePercentage ?? null,
        maxLateFee: pricing.maxLateFee ?? null,
        shippingMode: pricing.shippingMode ?? null,
        shippingFee: pricing.shippingFee ?? null,
      },
      update: {
        mode: pricing.mode,
        rentalPrice: pricing.rentalPrice ?? null,
        includedDays: pricing.includedDays ?? null,
        pricePerDay: pricing.pricePerDay ?? null,
        minimumDays: pricing.minimumDays ?? null,
        retailPrice: pricing.retailPrice ?? null,
        rentalPercentage: pricing.rentalPercentage ?? null,
        calculatedPrice,
        priceOverride: pricing.priceOverride ?? null,
        minInternalPrice: pricing.minInternalPrice ?? null,
        maxDiscountPrice: pricing.maxDiscountPrice ?? null,
        extendedRentalRate: pricing.extendedRentalRate ?? null,
        lateFeeType: pricing.lateFeeType ?? null,
        lateFeeAmount: pricing.lateFeeAmount ?? null,
        lateFeePercentage: pricing.lateFeePercentage ?? null,
        maxLateFee: pricing.maxLateFee ?? null,
        shippingMode: pricing.shippingMode ?? null,
        shippingFee: pricing.shippingFee ?? null,
      },
    });
  }

  private async upsertServices(tx: any, tenantId: string, productId: string, services: any) {
    await tx.productServices.upsert({
      where: { productId },
      create: {
        tenantId,
        productId,
        depositAmount: services.depositAmount ?? null,
        cleaningFee: services.cleaningFee ?? null,
        backupSizeEnabled: services.backupSizeEnabled ?? false,
        backupSizeFee: services.backupSizeFee ?? null,
        tryOnEnabled: services.tryOnEnabled ?? false,
        tryOnFee: services.tryOnFee ?? null,
        tryOnDurationHours: services.tryOnDurationHours ?? 24,
        tryOnCreditToRental: services.tryOnCreditToRental ?? false,
      },
      update: {
        depositAmount: services.depositAmount ?? undefined,
        cleaningFee: services.cleaningFee ?? undefined,
        backupSizeEnabled: services.backupSizeEnabled ?? undefined,
        backupSizeFee: services.backupSizeFee ?? undefined,
        tryOnEnabled: services.tryOnEnabled ?? undefined,
        tryOnFee: services.tryOnFee ?? undefined,
        tryOnDurationHours: services.tryOnDurationHours ?? undefined,
        tryOnCreditToRental: services.tryOnCreditToRental ?? undefined,
      },
    });
  }
}
