import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
} from './dto/customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // CRUD
  // =========================================================================

  /**
   * Create a new customer. If phone already exists for this tenant,
   * returns the existing customer (deduplication).
   */
  async create(tenantId: string, dto: CreateCustomerDto) {
    // Check for existing customer with same phone
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId, phone: dto.phone, deletedAt: null },
    });

    if (existing) {
      // Update name/address if changed, return existing with flag
      const updated = await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          fullName: dto.fullName,
          altPhone: dto.altPhone ?? existing.altPhone,
          email: dto.email ?? existing.email,
          addressLine1: dto.addressLine1 ?? existing.addressLine1,
          addressLine2: dto.addressLine2 ?? existing.addressLine2,
          city: dto.city ?? existing.city,
          state: dto.state ?? existing.state,
          postalCode: dto.postalCode ?? existing.postalCode,
          country: dto.country ?? existing.country,
        },
        include: { tags: true },
      });
      return { ...updated, tags: updated.tags.map((t) => t.tag), wasExisting: true };
    }

    const created = await this.prisma.customer.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone,
        altPhone: dto.altPhone,
        email: dto.email,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        notes: dto.notes,
      },
      include: { tags: true },
    });
    return { ...created, tags: created.tags.map((t) => t.tag), wasExisting: false };
  }

  /**
   * Find or create a customer by phone number.
   * Used during checkout to auto-create/link customers. (Output contract for P07)
   */
  async findOrCreateByPhone(
    tenantId: string,
    phone: string,
    data: Partial<CreateCustomerDto>,
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
    });

    if (existing) {
      // Update with any new data provided
      const updateData: Record<string, unknown> = {};
      if (data.fullName) updateData.fullName = data.fullName;
      if (data.altPhone) updateData.altPhone = data.altPhone;
      if (data.email) updateData.email = data.email;
      if (data.addressLine1) updateData.addressLine1 = data.addressLine1;
      if (data.addressLine2) updateData.addressLine2 = data.addressLine2;
      if (data.city) updateData.city = data.city;
      if (data.state) updateData.state = data.state;
      if (data.postalCode) updateData.postalCode = data.postalCode;
      if (data.country) updateData.country = data.country;

      if (Object.keys(updateData).length > 0) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      return existing;
    }

    return this.prisma.customer.create({
      data: {
        tenantId,
        fullName: data.fullName || 'Guest',
        phone,
        altPhone: data.altPhone,
        email: data.email,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
      },
    });
  }

  async getById(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: {
        tags: true,
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            grandTotal: true,
            createdAt: true,
            items: {
              select: {
                productName: true,
                colorName: true,
              },
            },
          },
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return {
      ...customer,
      tags: customer.tags.map((t) => t.tag),
    };
  }

  async update(tenantId: string, customerId: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customer.update({
      where: { id: customerId },
      data: dto,
      include: { tags: true },
    });
  }

  async list(tenantId: string, query: CustomerQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
    };

    // Search by name or phone
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    // Filter by tag
    if (query.tag) {
      where.tags = { some: { tag: query.tag } };
    }

    const orderBy = this.buildOrderBy(query.sort, query.order);

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tags: { select: { tag: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.tag),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Soft delete — fails if customer has active bookings.
   */
  async softDelete(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Check for active bookings
    const activeBookings = await this.prisma.booking.count({
      where: {
        customerId,
        tenantId,
        status: { in: ['pending', 'confirmed', 'shipped', 'delivered'] },
      },
    });

    if (activeBookings > 0) {
      throw new UnprocessableEntityException(
        `Cannot delete: customer has ${activeBookings} active booking(s)`,
      );
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
    });
  }

  // =========================================================================
  // PHONE LOOKUP (public, for checkout auto-fill)
  // =========================================================================

  async lookupByPhone(tenantId: string, phone: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
      select: {
        fullName: true,
        phone: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    return {
      found: !!customer,
      customer: customer || null,
    };
  }

  // =========================================================================
  // TAGS
  // =========================================================================

  async addTag(tenantId: string, customerId: string, tag: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Upsert — ignore if tag already exists
    await this.prisma.customerTag.upsert({
      where: {
        customerId_tag: { customerId, tag },
      },
      create: {
        tenantId,
        customerId,
        tag,
      },
      update: {},
    });

    return { message: `Tag "${tag}" added` };
  }

  async removeTag(tenantId: string, customerId: string, tag: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.prisma.customerTag.deleteMany({
      where: { customerId, tag, tenantId },
    });

    return { message: `Tag "${tag}" removed` };
  }

  /**
   * List all unique tags used in this tenant (for filter dropdown).
   */
  async listTenantTags(tenantId: string) {
    const tags = await this.prisma.customerTag.findMany({
      where: { tenantId },
      select: { tag: true },
      distinct: ['tag'],
      orderBy: { tag: 'asc' },
    });

    return tags.map((t) => t.tag);
  }

  // =========================================================================
  // STATS UPDATE (called via events from booking/payment modules)
  // =========================================================================

  /**
   * Increment customer stats after a booking is created/confirmed.
   */
  async incrementBookingCount(customerId: string, tenantId: string) {
    await this.prisma.customer.updateMany({
      where: { id: customerId, tenantId },
      data: {
        totalBookings: { increment: 1 },
        lastBookingAt: new Date(),
      },
    });
  }

  /**
   * Increment total spent after a payment is recorded.
   */
  async incrementTotalSpent(customerId: string, amount: number, tenantId: string) {
    await this.prisma.customer.updateMany({
      where: { id: customerId, tenantId },
      data: {
        totalSpent: { increment: amount },
      },
    });
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private buildOrderBy(sort?: string, order?: string): Prisma.CustomerOrderByWithRelationInput {
    const direction: Prisma.SortOrder = order === 'asc' ? 'asc' : 'desc';

    switch (sort) {
      case 'name':
        return { fullName: direction };
      case 'total_bookings':
        return { totalBookings: direction };
      case 'total_spent':
        return { totalSpent: direction };
      case 'last_booking_at':
        return { lastBookingAt: direction };
      default:
        return { createdAt: 'desc' };
    }
  }
}
