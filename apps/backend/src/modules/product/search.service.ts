import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full-text search using PostgreSQL tsvector (search_vector column).
   * Falls back to fuzzy matching via pg_trgm if < 3 results.
   */
  async search(tenantId: string, query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    // PostgreSQL full-text search via raw query
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .map((w) => `${w}:*`)
      .join(' & ');

    const results: any[] = await this.prisma.$queryRaw`
      SELECT p.id, p.name, p.slug, p.total_bookings,
             ts_rank(p.search_vector, to_tsquery('english', ${tsQuery})) as rank
      FROM products p
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.status = 'published'
        AND p.deleted_at IS NULL
        AND p.is_available = true
        AND p.search_vector @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${take}
      OFFSET ${skip}
    `;

    // If few results, try fuzzy matching
    if (results.length < 3) {
      const fuzzyResults: any[] = await this.prisma.$queryRaw`
        SELECT p.id, p.name, p.slug, p.total_bookings,
               similarity(p.name, ${query}) as sim
        FROM products p
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'published'
          AND p.deleted_at IS NULL
          AND p.is_available = true
          AND similarity(p.name, ${query}) > 0.2
          AND p.id NOT IN (${results.length > 0 ? results.map((r) => r.id).join("','") : 'NULL'})
        ORDER BY sim DESC
        LIMIT ${take - results.length}
      `;

      results.push(...fuzzyResults);
    }

    // Hydrate results with full product data
    if (results.length === 0) {
      return { results: [], total: 0, query };
    }

    const productIds = results.map((r) => r.id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        pricing: {
          select: {
            mode: true,
            rentalPrice: true,
            pricePerDay: true,
            calculatedPrice: true,
            priceOverride: true,
            includedDays: true,
          },
        },
        services: { select: { depositAmount: true } },
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
      },
    });

    // Preserve search rank ordering
    const productMap = new Map(products.map((p) => [p.id, p]));
    const ordered = productIds
      .map((id) => productMap.get(id))
      .filter(Boolean);

    return {
      results: ordered,
      total: ordered.length,
      query,
    };
  }

  /**
   * Auto-suggest as user types (min 3 chars).
   */
  async suggest(tenantId: string, query: string) {
    if (query.length < 3) return { suggestions: [] };

    const pattern = `%${query}%`;

    // Search products
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        status: 'published',
        deletedAt: null,
        name: { contains: query, mode: 'insensitive' },
      },
      take: 5,
      select: { name: true, slug: true },
    });

    // Search categories/subcategories
    const categories = await this.prisma.subcategory.findMany({
      where: {
        tenantId,
        isActive: true,
        name: { contains: query, mode: 'insensitive' },
      },
      take: 3,
      select: {
        name: true,
        slug: true,
        category: { select: { slug: true } },
      },
    });

    const suggestions = [
      ...products.map((p) => ({
        type: 'product' as const,
        text: p.name,
        slug: p.slug,
      })),
      ...categories.map((c) => ({
        type: 'category' as const,
        text: c.name,
        slug: `${c.category.slug}?subcategory=${c.slug}`,
      })),
    ];

    return { suggestions };
  }

  /**
   * Get available filter options with counts for the current query.
   */
  async getFilterCounts(tenantId: string) {
    const baseWhere = {
      tenantId,
      status: 'published' as const,
      deletedAt: null,
      isAvailable: true,
    };

    const [categories, events, priceRange] = await Promise.all([
      // Category counts
      this.prisma.category.findMany({
        where: { tenantId, isActive: true },
        select: {
          name: true,
          slug: true,
          _count: {
            select: {
              products: { where: baseWhere },
            },
          },
        },
      }),
      // Event counts
      this.prisma.event.findMany({
        where: { tenantId, isActive: true },
        select: {
          name: true,
          slug: true,
          _count: {
            select: {
              products: { where: { product: baseWhere } },
            },
          },
        },
      }),
      // Price range
      this.prisma.productPricing.aggregate({
        where: {
          product: baseWhere,
        },
        _min: { rentalPrice: true },
        _max: { rentalPrice: true },
      }),
    ]);

    return {
      categories: categories
        .filter((c) => c._count.products > 0)
        .map((c) => ({ slug: c.slug, name: c.name, count: c._count.products })),
      events: events
        .filter((e) => e._count.products > 0)
        .map((e) => ({ slug: e.slug, name: e.name, count: e._count.products })),
      priceRange: {
        min: priceRange._min.rentalPrice || 0,
        max: priceRange._max.rentalPrice || 0,
      },
    };
  }
}
