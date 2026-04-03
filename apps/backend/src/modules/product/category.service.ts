/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
  CreateEventDto,
  UpdateEventDto,
} from './dto/create-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  /**
   * List categories with subcategories and product counts (guest view).
   */
  async listCategories(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: { select: { products: true } },
          },
        },
        _count: { select: { products: true } },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      productCount: cat._count.products,
      subcategories: cat.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        productCount: sub._count.products,
      })),
    }));
  }

  /**
   * List all categories including inactive (owner view).
   */
  async listCategoriesOwner(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { displayOrder: 'asc' },
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    const slug = this.slugify(dto.name);

    // Check slug uniqueness within tenant
    const existing = await this.prisma.category.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (existing) {
      throw new UnprocessableEntityException('A category with this name already exists');
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        icon: dto.icon,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateCategory(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.findCategoryOrFail(tenantId, categoryId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name);
    }
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.category.updateMany({
      where: { id: categoryId, tenantId },
      data,
    });

    return this.prisma.category.findFirst({ where: { id: categoryId, tenantId } });
  }

  async deleteCategory(tenantId: string, categoryId: string) {
    const category = await this.findCategoryOrFail(tenantId, categoryId);

    // Check if products exist
    const productCount = await this.prisma.product.count({
      where: { categoryId, tenantId, deletedAt: null },
    });

    if (productCount > 0) {
      throw new UnprocessableEntityException(
        `Category has ${productCount} products. Move or delete them first.`,
      );
    }

    // Delete subcategories first, then category
    await this.prisma.$transaction([
      this.prisma.subcategory.deleteMany({ where: { categoryId, tenantId } }),
      this.prisma.category.deleteMany({ where: { id: categoryId, tenantId } }),
    ]);

    return { message: 'Category deleted' };
  }

  // =========================================================================
  // SUBCATEGORIES
  // =========================================================================

  async createSubcategory(tenantId: string, categoryId: string, dto: CreateSubcategoryDto) {
    await this.findCategoryOrFail(tenantId, categoryId);

    const slug = this.slugify(dto.name);

    return this.prisma.subcategory.create({
      data: {
        tenantId,
        categoryId,
        name: dto.name,
        slug,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateSubcategory(tenantId: string, subcategoryId: string, dto: UpdateSubcategoryDto) {
    const sub = await this.prisma.subcategory.findFirst({
      where: { id: subcategoryId, tenantId },
    });
    if (!sub) throw new NotFoundException('Subcategory not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name);
    }
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.subcategory.updateMany({
      where: { id: subcategoryId, tenantId },
      data,
    });

    return this.prisma.subcategory.findFirst({ where: { id: subcategoryId, tenantId } });
  }

  async deleteSubcategory(tenantId: string, subcategoryId: string) {
    const sub = await this.prisma.subcategory.findFirst({
      where: { id: subcategoryId, tenantId },
    });
    if (!sub) throw new NotFoundException('Subcategory not found');

    const productCount = await this.prisma.product.count({
      where: { subcategoryId, tenantId, deletedAt: null },
    });
    if (productCount > 0) {
      throw new UnprocessableEntityException(
        `Subcategory has ${productCount} products. Move or delete them first.`,
      );
    }

    await this.prisma.subcategory.deleteMany({ where: { id: subcategoryId, tenantId } });
    return { message: 'Subcategory deleted' };
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  async listEvents(tenantId: string) {
    const events = await this.prisma.event.findMany({
      where: { tenantId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    return events.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      productCount: e._count.products,
    }));
  }

  async listEventsOwner(tenantId: string) {
    return this.prisma.event.findMany({
      where: { tenantId },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  async createEvent(tenantId: string, dto: CreateEventDto) {
    const slug = this.slugify(dto.name);

    return this.prisma.event.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateEvent(tenantId: string, eventId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name);
    }
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.event.updateMany({
      where: { id: eventId, tenantId },
      data,
    });

    return this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
  }

  async deleteEvent(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Remove product-event associations then delete
    // Join through event to scope by tenant
    await this.prisma.$transaction([
      this.prisma.productEvent.deleteMany({
        where: { event: { id: eventId, tenantId } },
      }),
      this.prisma.event.deleteMany({ where: { id: eventId, tenantId } }),
    ]);

    return { message: 'Event deleted' };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async findCategoryOrFail(tenantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
