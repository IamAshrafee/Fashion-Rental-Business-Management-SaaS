import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
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
            lateFeeType: dto.pricing.lateFeeType as any ?? null,
            lateFeeAmount: dto.pricing.lateFeeAmount ?? null,
            lateFeePercentage: dto.pricing.lateFeePercentage ?? null,
            maxLateFee: dto.pricing.maxLateFee ?? null,
            shippingMode: dto.pricing.shippingMode as any ?? null,
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

      // 5. Create size
      if (dto.size) {
        const productSize = await tx.productSize.create({
          data: {
            tenantId,
            productId: product.id,
            mode: dto.size.mode as any,
            freeSizeType: dto.size.freeSizeType as any ?? null,
            availableSizes: dto.size.availableSizes ?? [],
            sizeChartUrl: dto.size.sizeChartUrl ?? null,
            mainDisplaySize: dto.size.mainDisplaySize ?? null,
          },
        });

        // Measurements (for 'measurement' mode)
        if (dto.size.measurements?.length) {
          await tx.sizeMeasurement.createMany({
            data: dto.size.measurements.map((m, i) => ({
              productSizeId: productSize.id,
              label: m.label,
              value: m.value,
              unit: m.unit || 'inch',
              sequence: i,
            })),
          });
        }

        // Parts (for 'multi_part' mode)
        if (dto.size.parts?.length) {
          for (let i = 0; i < dto.size.parts.length; i++) {
            const part = dto.size.parts[i];
            const created = await tx.sizePart.create({
              data: {
                productSizeId: productSize.id,
                partName: part.partName,
                sequence: i,
              },
            });

            if (part.measurements?.length) {
              await tx.sizeMeasurement.createMany({
                data: part.measurements.map((m, j) => ({
                  productSizeId: productSize.id,
                  partId: created.id,
                  label: m.label,
                  value: m.value,
                  unit: m.unit || 'inch',
                  sequence: j,
                })),
              });
            }
          }
        }
      }

      // 6. Create FAQs
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
      if (dto.size) {
        await this.replaceSize(tx, tenantId, productId, dto.size);
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
      data: { status: status as any },
    });

    if (status === 'published' && product.status !== 'published') {
      this.eventEmitter.emit('product.created', { tenantId, productId });
    }

    return updated;
  }

  // =========================================================================
  // SOFT DELETE / RESTORE / PERMANENT DELETE
  // =========================================================================

  async softDelete(tenantId: string, productId: string) {
    await this.findProductOrFail(tenantId, productId);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), status: 'archived' },
    });

    this.eventEmitter.emit('product.deleted', { tenantId, productId });
    return updated;
  }

  async restore(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: { not: null } },
    });
    if (!product) throw new NotFoundException('Product not found in trash');

    return this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: null, status: 'draft' },
    });
  }

  async permanentDelete(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: { not: null } },
    });
    if (!product) throw new NotFoundException('Product not found in trash');

    // Check for active bookings
    const activeBookings = await this.prisma.bookingItem.count({
      where: {
        productId,
        booking: {
          status: { in: ['pending', 'confirmed', 'shipped', 'delivered'] },
        },
      },
    });
    if (activeBookings > 0) {
      throw new UnprocessableEntityException(
        `Cannot permanently delete: product has ${activeBookings} active booking(s)`,
      );
    }

    await this.prisma.product.delete({ where: { id: productId } });
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
        include: {
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
            orderBy: { sequence: 'asc' },
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
        },
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
      where.status = query.status as any;
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
        orderBy: { createdAt: 'desc' },
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
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');
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

  private buildOrderBy(sort?: string, order?: string): Prisma.ProductOrderByWithRelationInput {
    const direction = order === 'asc' ? 'asc' : 'desc';

    switch (sort) {
      case 'price_asc':
        return { pricing: { rentalPrice: 'asc' } };
      case 'price_desc':
        return { pricing: { rentalPrice: 'desc' } };
      case 'popularity':
        return { totalBookings: 'desc' };
      case 'newest':
        return { createdAt: 'desc' };
      default:
        return { createdAt: direction as Prisma.SortOrder };
    }
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
      productSize: {
        include: {
          measurements: { orderBy: { sequence: 'asc' as const } },
          parts: {
            orderBy: { sequence: 'asc' as const },
            include: {
              measurements: { orderBy: { sequence: 'asc' as const } },
            },
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
    return {
      ...product,
      events: product.events?.map((pe: any) => pe.event) || [],
      variants: product.variants?.map((v: any) => ({
        ...v,
        identicalColors: v.identicalColors?.map((vc: any) => vc.color) || [],
      })),
      details: product.detailHeaders?.map((h: any) => ({
        id: h.id,
        header: h.headerName,
        entries: h.entries || [],
      })),
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

  private async replaceSize(tx: any, tenantId: string, productId: string, size: any) {
    // Delete existing size data
    const existing = await tx.productSize.findUnique({ where: { productId } });
    if (existing) {
      await tx.sizeMeasurement.deleteMany({ where: { productSizeId: existing.id } });
      await tx.sizePart.deleteMany({ where: { productSizeId: existing.id } });
      await tx.productSize.delete({ where: { id: existing.id } });
    }

    // Recreate
    const productSize = await tx.productSize.create({
      data: {
        tenantId,
        productId,
        mode: size.mode,
        freeSizeType: size.freeSizeType ?? null,
        availableSizes: size.availableSizes ?? [],
        sizeChartUrl: size.sizeChartUrl ?? null,
        mainDisplaySize: size.mainDisplaySize ?? null,
      },
    });

    if (size.measurements?.length) {
      await tx.sizeMeasurement.createMany({
        data: size.measurements.map((m: any, i: number) => ({
          productSizeId: productSize.id,
          label: m.label,
          value: m.value,
          unit: m.unit || 'inch',
          sequence: i,
        })),
      });
    }

    if (size.parts?.length) {
      for (let i = 0; i < size.parts.length; i++) {
        const part = size.parts[i];
        const created = await tx.sizePart.create({
          data: {
            productSizeId: productSize.id,
            partName: part.partName,
            sequence: i,
          },
        });

        if (part.measurements?.length) {
          await tx.sizeMeasurement.createMany({
            data: part.measurements.map((m: any, j: number) => ({
              productSizeId: productSize.id,
              partId: created.id,
              label: m.label,
              value: m.value,
              unit: m.unit || 'inch',
              sequence: j,
            })),
          });
        }
      }
    }
  }
}
