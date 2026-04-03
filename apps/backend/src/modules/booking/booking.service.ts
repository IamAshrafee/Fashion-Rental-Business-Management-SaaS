import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { BookingStatus, CancelledBy, DamageLevel, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import type { ProductPricing, ProductServices } from '@prisma/client';
import {
  CreateBookingDto,
  ValidateCartDto,
  CartItemDto,
  BookingQueryDto,
  BlockDatesDto,
  CreateDamageReportDto,
  ShipBookingDto,
  CancelBookingDto,
} from './dto/booking.dto';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface PricingSnapshot {
  baseRental: number;
  extendedDays: number;
  extendedCost: number;
  depositAmount: number;
  cleaningFee: number;
  backupSizeFee: number;
  tryOnFee: number;
  shippingFee: number;
  itemTotal: number;
  rentalDays: number;
}

interface CartItemResult extends PricingSnapshot {
  productId: string;
  variantId: string;
  available: boolean;
  productName: string;
  variantName: string | null;
  colorName: string;
  featuredImageUrl: string;
  errors?: string[];
}

interface CartSummary {
  subtotal: number;
  totalFees: number;
  totalDeposit: number;
  shippingFee: number;
  grandTotal: number;
}

// ---------------------------------------------------------------------------
// Status transition map (ADR-02)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['returned', 'overdue'],
  overdue: ['returned'],
  returned: ['inspected'],
  inspected: ['completed'],
  cancelled: [],
  completed: [],
};

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerService: CustomerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================================
  // AVAILABILITY
  // =========================================================================

  /**
   * Returns blocked dates for a product in a given month.
   * Format: { "YYYY-MM-DD": "booked" | "pending" | "blocked" }
   * Dates not in the map are free.
   */
  async checkAvailability(tenantId: string, productId: string, month: string) {
    // Validate product exists and is published
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { id: true, status: true, isAvailable: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Parse month → date range
    const [year, mon] = month.split('-').map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0); // last day of month

    const blocks = await this.prisma.dateBlock.findMany({
      where: {
        tenantId,
        productId,
        // Overlap: block.startDate <= endOfMonth AND block.endDate >= startOfMonth
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      select: {
        startDate: true,
        endDate: true,
        blockType: true,
      },
    });

    const dateMap: Record<string, string> = {};

    for (const block of blocks) {
      const blockTypeLabel =
        block.blockType === 'booking'
          ? 'booked'
          : block.blockType === 'pending'
            ? 'pending'
            : 'blocked';

      // Iterate each date in the block range
      const cursor = new Date(block.startDate);
      while (cursor <= block.endDate) {
        const isoDate = cursor.toISOString().split('T')[0];
        // Only include dates within the requested month
        const d = new Date(isoDate);
        if (d >= startOfMonth && d <= endOfMonth) {
          dateMap[isoDate] = blockTypeLabel;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return {
      productId,
      month,
      isAvailable: product.isAvailable && product.status === 'published',
      dates: dateMap,
    };
  }

  /**
   * Checks if a specific date range is available for a product.
   * Returns availability status + calculated pricing.
   */
  async checkDateRange(
    tenantId: string,
    productId: string,
    startDate: string,
    endDate: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, status: 'published', isAvailable: true, deletedAt: null },
      include: { pricing: true, services: true },
    });

    if (!product) {
      return { available: false, reason: 'Product not available' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return { available: false, reason: 'Start date must be before end date' };
    }

    // Check overlapping date blocks
    const conflict = await this.prisma.dateBlock.findFirst({
      where: {
        tenantId,
        productId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { startDate: true, endDate: true },
    });

    if (conflict) {
      // Find next available date after the conflict
      const conflictEnd = new Date(conflict.endDate);
      conflictEnd.setDate(conflictEnd.getDate() + 1);

      return {
        available: false,
        conflictDates: [
          conflict.startDate.toISOString().split('T')[0],
          conflict.endDate.toISOString().split('T')[0],
        ],
        nextAvailable: conflictEnd.toISOString().split('T')[0],
      };
    }

    // Calculate pricing
    const pricing = this.calculatePricingForDates(product.pricing, product.services, {
      startDate,
      endDate,
      backupSize: undefined,
      tryOn: false,
    });

    return {
      available: true,
      rentalDays: pricing.rentalDays,
      pricing: {
        baseRental: pricing.baseRental,
        extendedDays: pricing.extendedDays,
        extendedCost: pricing.extendedCost,
        deposit: pricing.depositAmount,
        cleaningFee: pricing.cleaningFee,
        shippingFee: pricing.shippingFee,
        total: pricing.itemTotal + pricing.shippingFee,
      },
    };
  }

  // =========================================================================
  // CART VALIDATION
  // =========================================================================

  /**
   * Validates all cart items — availability + pricing.
   * Called before checkout to show accurate prices and detect conflicts.
   */
  async validateCart(tenantId: string, dto: ValidateCartDto) {
    const results: CartItemResult[] = [];
    let anyUnavailable = false;

    for (const item of dto.items) {
      const result = await this.validateSingleItem(tenantId, item);
      results.push(result);
      if (!result.available) anyUnavailable = true;
    }

    const summary = this.computeSummary(results);

    return {
      valid: !anyUnavailable,
      items: results.map((item) => ({
        productId: item.productId,
        available: item.available,
        rentalDays: item.rentalDays,
        rentalPrice: item.baseRental,
        deposit: item.depositAmount,
        cleaningFee: item.cleaningFee,
        extendedDays: item.extendedDays,
        extendedCost: item.extendedCost,
        backupSizeFee: item.backupSizeFee,
        tryOnFee: item.tryOnFee,
        itemTotal: item.itemTotal,
        shippingFee: item.shippingFee,
        errors: item.errors,
      })),
      summary: {
        subtotal: summary.subtotal,
        totalFees: summary.totalFees,
        totalDeposit: summary.totalDeposit,
        shippingFee: summary.shippingFee,
        grandTotal: summary.grandTotal,
      },
    };
  }

  // =========================================================================
  // BOOKING CREATION (ATOMIC)
  // =========================================================================

  /**
   * Creates a booking atomically:
   * 1. Find/create customer by phone
   * 2. Re-validate all items
   * 3. Generate booking number
   * 4. Create Booking + BookingItems + DateBlocks in one transaction
   * 5. Emit booking.created event
   */
  async createBooking(tenantId: string, dto: CreateBookingDto) {
    // Step 1: Find or create customer (outside transaction — idempotent)
    const customer = await this.customerService.findOrCreateByPhone(
      tenantId,
      dto.customer.phone,
      {
        fullName: dto.customer.fullName,
        altPhone: dto.customer.altPhone,
        email: dto.customer.email,
        addressLine1: dto.delivery.address,
        city: dto.delivery.city ?? dto.delivery.district,
        state: dto.delivery.state,
        postalCode: dto.delivery.postalCode,
        country: dto.delivery.country,
      },
    );

    // Steps 2-4: Validate + create atomically inside a single transaction
    // This prevents double-booking: the availability check and DateBlock creation
    // are serialized via the transaction, so concurrent requests cannot both pass.
    const booking = await this.prisma.$transaction(async (tx) => {
      // Step 2: Validate all items INSIDE the transaction
      const validatedItems: CartItemResult[] = [];
      for (const item of dto.items) {
        const result = await this.validateSingleItemTx(tx, tenantId, item);
        if (!result.available) {
          throw new ConflictException(
            `Product "${result.productName}" is not available for the selected dates: ${item.startDate} – ${item.endDate}`,
          );
        }
        validatedItems.push(result);
      }

      const summary = this.computeSummary(validatedItems);

      // Step 3: Generate booking number (with row-level locking)
      const year = new Date().getFullYear();
      const bookingNumber = await this.generateBookingNumber(tx, tenantId, year);

      // Store settings for buffer days
      const storeSettings = await tx.storeSettings.findUnique({
        where: { tenantId },
        select: { bufferDays: true },
      });
      const bufferDays = storeSettings?.bufferDays ?? 0;

      // Build delivery address extra (area, thana, district)
      const deliveryExtra: Record<string, string> = {};
      if (dto.delivery.area) deliveryExtra.area = dto.delivery.area;
      if (dto.delivery.thana) deliveryExtra.thana = dto.delivery.thana;
      if (dto.delivery.district) deliveryExtra.district = dto.delivery.district;
      if (dto.delivery.extra) {
        for (const [k, v] of Object.entries(dto.delivery.extra)) {
          if (typeof v === 'string') deliveryExtra[k] = v;
        }
      }

      // Step 4: Create booking
      const newBooking = await tx.booking.create({
        data: {
          tenantId,
          bookingNumber,
          customerId: customer.id,
          status: 'pending',
          paymentMethod: dto.paymentMethod as PaymentMethod,
          paymentStatus: 'unpaid',
          subtotal: summary.subtotal,
          totalFees: summary.totalFees,
          shippingFee: summary.shippingFee,
          totalDeposit: summary.totalDeposit,
          grandTotal: summary.grandTotal,
          totalPaid: 0,
          deliveryName: dto.customer.fullName,
          deliveryPhone: dto.customer.phone,
          deliveryAltPhone: dto.customer.altPhone ?? null,
          deliveryAddressLine1: dto.delivery.address,
          deliveryAddressLine2: null,
          deliveryCity: dto.delivery.city ?? dto.delivery.district ?? '',
          deliveryState: dto.delivery.state ?? null,
          deliveryPostalCode: dto.delivery.postalCode ?? null,
          deliveryCountry: dto.delivery.country ?? 'BD',
          deliveryExtra: Object.keys(deliveryExtra).length > 0 ? deliveryExtra : Prisma.DbNull,
          customerNotes: dto.customerNotes ?? null,
        },
      });

      // Create booking items + date blocks
      for (const item of validatedItems) {
        // Create booking item
        await tx.bookingItem.create({
          data: {
            tenantId,
            bookingId: newBooking.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName ?? null,
            colorName: item.colorName,
            featuredImageUrl: item.featuredImageUrl,
            startDate: new Date(dto.items.find((i) => i.productId === item.productId)!.startDate),
            endDate: new Date(dto.items.find((i) => i.productId === item.productId)!.endDate),
            rentalDays: item.rentalDays,
            baseRental: item.baseRental,
            extendedDays: item.extendedDays,
            extendedCost: item.extendedCost,
            depositAmount: item.depositAmount,
            depositStatus: 'pending',
            cleaningFee: item.cleaningFee,
            backupSizeFee: item.backupSizeFee,
            tryOnFee: item.tryOnFee,
            itemTotal: item.itemTotal,
            lateFee: 0,
            lateDays: 0,
          },
        });

        // Create date block (type = pending until confirmed)
        const cartItem = dto.items.find((i) => i.productId === item.productId)!;
        const startDate = new Date(cartItem.startDate);
        const endDate = new Date(cartItem.endDate);

        // Apply buffer days
        if (bufferDays > 0) {
          startDate.setDate(startDate.getDate() - bufferDays);
          endDate.setDate(endDate.getDate() + bufferDays);
        }

        await tx.dateBlock.create({
          data: {
            tenantId,
            productId: item.productId,
            startDate,
            endDate,
            blockType: 'pending',
            bookingId: newBooking.id,
          },
        });
      }

      return tx.booking.findUnique({
        where: { id: newBooking.id },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
          items: {
            select: {
              id: true,
              productName: true,
              colorName: true,
              sizeInfo: true,
              startDate: true,
              endDate: true,
              rentalDays: true,
              baseRental: true,
              depositAmount: true,
              itemTotal: true,
            },
          },
        },
      });
    }, {
      // Serializable isolation prevents phantom reads — if two bookings
      // try to check the same DateBlock range concurrently, one will retry.
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    });

    if (!booking) throw new UnprocessableEntityException('Failed to create booking');

    // Step 5: Emit event (ADR-05)
    this.eventEmitter.emit('booking.created', {
      tenantId,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      grandTotal: booking.grandTotal,
    });

    this.logger.log(`Booking created: ${booking.bookingNumber} (tenant: ${tenantId})`);

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      grandTotal: booking.grandTotal,
      breakdown: {
        subtotal: booking.subtotal,
        totalFees: booking.totalFees,
        shippingFee: booking.shippingFee,
        totalDeposit: booking.totalDeposit,
        grandTotal: booking.grandTotal,
      },
      customer: booking.customer,
      items: booking.items,
    };
  }

  // =========================================================================
  // BOOKING QUERIES
  // =========================================================================

  async getBookingList(tenantId: string, query: BookingQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status as BookingStatus;
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { bookingNumber: { contains: query.search, mode: 'insensitive' } },
        { deliveryName: { contains: query.search, mode: 'insensitive' } },
        { deliveryPhone: { contains: query.search } },
        { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: query.search } } },
      ];
    }

    // Calendar filter: find bookings where any item's rental period overlaps [itemDateFrom, itemDateTo]
    if (query.itemDateFrom || query.itemDateTo) {
      const itemFilter: Prisma.BookingItemWhereInput = {};
      if (query.itemDateFrom) {
        // Item must end on or after the range start
        itemFilter.endDate = { gte: new Date(query.itemDateFrom) };
      }
      if (query.itemDateTo) {
        // Item must start on or before the range end
        itemFilter.startDate = { lte: new Date(query.itemDateTo) };
      }
      where.items = { some: itemFilter };
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true, email: true },
          },
          items: {
            select: {
              id: true,
              productName: true,
              colorName: true,
              sizeInfo: true,
              startDate: true,
              endDate: true,
              rentalDays: true,
              itemTotal: true,
              featuredImageUrl: true,
            },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingById(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      include: {
        customer: {
          include: { tags: true },
        },
        items: {
          include: {
            damageReport: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async getBookingByNumber(tenantId: string, bookingNumber: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { bookingNumber, tenantId },
      select: {
        bookingNumber: true,
        status: true,
        trackingNumber: true,
        courierProvider: true,
        courierStatus: true,
        courierStatusHistory: true,
        pickupRequestedAt: true,
        deliveryName: true,
        deliveryAddressLine1: true,
        grandTotal: true,
        totalPaid: true,
        createdAt: true,
        confirmedAt: true,
        shippedAt: true,
        deliveredAt: true,
        returnedAt: true,
        completedAt: true,
        items: {
          select: {
            productName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // Build unified timeline: business stages + courier milestones
    type TimelineEvent = { status: string; label: string; at: Date | string; type: 'business' | 'courier' };

    const timeline: TimelineEvent[] = [
      { status: 'pending', label: 'Order Placed', at: booking.createdAt, type: 'business' },
    ];
    if (booking.confirmedAt)  timeline.push({ status: 'confirmed',  label: 'Order Confirmed',  at: booking.confirmedAt, type: 'business' });

    // Merge courier status history events chronologically
    if (Array.isArray(booking.courierStatusHistory)) {
      const history = booking.courierStatusHistory as Array<{
        status: string;
        label: string;
        timestamp: string;
        source: string;
      }>;

      for (const event of history) {
        // Skip duplicates of business stages already in the timeline
        if (event.status === 'pickup_pending' || event.status === 'pickup_assigned' ||
            event.status === 'pickup_failed' || event.status === 'picked_up' ||
            event.status === 'at_hub' || event.status === 'in_transit' ||
            event.status === 'at_destination' || event.status === 'out_for_delivery' ||
            event.status === 'partial_delivered' || event.status === 'returned_to_sender' ||
            event.status === 'on_hold' || event.status === 'unknown') {
          timeline.push({
            status: event.status,
            label: event.label,
            at: event.timestamp,
            type: 'courier',
          });
        }
      }
    }

    if (booking.shippedAt)    timeline.push({ status: 'shipped',    label: 'Order Shipped',    at: booking.shippedAt, type: 'business' });
    if (booking.deliveredAt)  timeline.push({ status: 'delivered',  label: 'Delivered',        at: booking.deliveredAt, type: 'business' });
    if (booking.returnedAt)   timeline.push({ status: 'returned',   label: 'Returned',         at: booking.returnedAt, type: 'business' });
    if (booking.completedAt)  timeline.push({ status: 'completed',  label: 'Completed',        at: booking.completedAt, type: 'business' });

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    // Calculate rental period from items
    const earliestStart = booking.items.reduce<Date | null>((min, item) => {
      return !min || item.startDate < min ? item.startDate : min;
    }, null);

    const latestEnd = booking.items.reduce<Date | null>((max, item) => {
      return !max || item.endDate > max ? item.endDate : max;
    }, null);

    const now = new Date();
    const rentalPeriod = earliestStart && latestEnd ? {
      startDate: earliestStart,
      endDate: latestEnd,
      totalDays: Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)),
      daysRemaining: Math.max(0, Math.ceil((latestEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      isActive: booking.status === 'delivered' && now >= earliestStart && now <= latestEnd,
      isOverdue: booking.status === 'delivered' && now > latestEnd,
    } : null;

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      trackingNumber: booking.trackingNumber,
      courierProvider: booking.courierProvider,
      courierStatus: booking.courierStatus,
      timeline,
      rentalPeriod,
      items: booking.items,
    };
  }

  async getBookingStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const [pendingCount, overdueCount, todayDeliveries, totalActive, recentBookings, revenueAgg, topProductsRaw, recentRevenueBookings] =
      await Promise.all([
        this.prisma.booking.count({
          where: { tenantId, status: 'pending', deletedAt: null },
        }),
        this.prisma.booking.count({
          where: { tenantId, status: 'overdue', deletedAt: null },
        }),
        this.prisma.booking.count({
          where: {
            tenantId,
            status: 'shipped',
            deletedAt: null,
            items: {
              some: {
                endDate: {
                  gte: today,
                  lt: tomorrow,
                },
              },
            },
          },
        }),
        this.prisma.booking.count({
          where: {
            tenantId,
            status: { in: ['pending', 'confirmed', 'shipped', 'delivered'] },
            deletedAt: null,
          },
        }),
        this.prisma.booking.findMany({
          where: { tenantId, deletedAt: null },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            grandTotal: true,
            deliveryName: true,
            createdAt: true,
          },
        }),
        this.prisma.booking.aggregate({
          _sum: { grandTotal: true },
          where: {
            tenantId,
            deletedAt: null,
            status: { notIn: ['pending', 'cancelled'] },
            createdAt: { gte: firstDayOfMonth },
          },
        }),
        this.prisma.bookingItem.groupBy({
          by: ['productId', 'productName', 'featuredImageUrl'],
          where: { tenantId, booking: { status: { notIn: ['pending', 'cancelled'] }, deletedAt: null } },
          _count: { productId: true },
          orderBy: { _count: { productId: 'desc' } },
          take: 5,
        }),
        this.prisma.booking.findMany({
          where: {
            tenantId,
            deletedAt: null,
            status: { notIn: ['pending', 'cancelled'] },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: { createdAt: true, grandTotal: true },
        }),
      ]);

    const revenueMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        revenueMap.set(dateStr, 0);
    }
    for (const b of recentRevenueBookings) {
        const dateStr = b.createdAt.toISOString().split('T')[0];
        if (revenueMap.has(dateStr)) {
            revenueMap.set(dateStr, revenueMap.get(dateStr)! + b.grandTotal);
        }
    }
    const revenueChart = Array.from(revenueMap.entries()).map(([date, revenue]) => ({ date, revenue }));

    const topProducts = topProductsRaw.map((item) => ({
      id: item.productId,
      name: item.productName,
      image: item.featuredImageUrl,
      count: item._count.productId,
    }));

    return {
      pendingCount,
      overdueCount,
      todayDeliveries,
      totalActive,
      recentBookings,
      revenueThisMonth: revenueAgg._sum.grandTotal || 0,
      revenueChart,
      topProducts,
    };
  }

  // =========================================================================
  // STATUS TRANSITIONS
  // =========================================================================

  async updateStatus(
    tenantId: string,
    bookingId: string,
    newStatus: BookingStatus,
    extras?: { trackingNumber?: string; courierProvider?: string },
  ) {
    const booking = await this.findBookingOrFail(tenantId, bookingId);

    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed.includes(newStatus)) {
      throw new UnprocessableEntityException(
        `Cannot transition from "${booking.status}" to "${newStatus}". ` +
          `Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const updateData: Prisma.BookingUpdateInput = { status: newStatus };

    // Set timestamp for each transition
    const now = new Date();
    switch (newStatus) {
      case 'confirmed':
        updateData.confirmedAt = now;
        // Update date_blocks from pending → booking
        await this.prisma.dateBlock.updateMany({
          where: { bookingId, blockType: 'pending' },
          data: { blockType: 'booking' },
        });
        break;
      case 'shipped':
        updateData.shippedAt = now;
        if (extras?.trackingNumber) updateData.trackingNumber = extras.trackingNumber;
        if (extras?.courierProvider) updateData.courierProvider = extras.courierProvider;
        break;
      case 'delivered':
        updateData.deliveredAt = now;
        break;
      case 'returned':
        updateData.returnedAt = now;
        break;
      case 'completed':
        updateData.completedAt = now;
        break;
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId, tenantId },
      data: updateData,
    });

    // Emit lifecycle event (ADR-05)
    this.eventEmitter.emit(`booking.${newStatus}`, {
      tenantId,
      bookingId,
      bookingNumber: updated.bookingNumber,
      customerId: updated.customerId,
    });

    // Update product/customer stats on completion
    if (newStatus === 'completed') {
      await this.updateStatsOnCompletion(tenantId, bookingId, updated);
    }

    this.logger.log(
      `Booking ${updated.bookingNumber}: ${booking.status} → ${newStatus}`,
    );

    return updated;
  }

  async shipBooking(tenantId: string, bookingId: string, dto: ShipBookingDto) {
    return this.updateStatus(tenantId, bookingId, 'shipped', {
      trackingNumber: dto.trackingNumber,
      courierProvider: dto.courierProvider,
    });
  }

  async cancelBooking(
    tenantId: string,
    bookingId: string,
    dto: CancelBookingDto,
    cancelledBy: CancelledBy,
  ) {
    const booking = await this.findBookingOrFail(tenantId, bookingId);

    // Cancellation rules from spec
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new UnprocessableEntityException(
        `Booking cannot be cancelled at status "${booking.status}". ` +
          'Cancellation is only allowed for pending or confirmed bookings.',
      );
    }

    if (cancelledBy === 'customer' && booking.status !== 'pending') {
      throw new UnprocessableEntityException(
        'Customers can only cancel pending bookings (before owner confirmation).',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Update booking
      await tx.booking.update({
        where: { id: bookingId, tenantId },
        data: {
          status: 'cancelled',
          cancellationReason: dto.reason,
          cancelledBy,
          cancelledAt: new Date(),
        },
      });

      // Release date blocks
      await tx.dateBlock.deleteMany({ where: { bookingId, tenantId } });
    });

    this.eventEmitter.emit('booking.cancelled', {
      tenantId,
      bookingId,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      reason: dto.reason,
      cancelledBy,
    });

    this.logger.log(`Booking ${booking.bookingNumber} cancelled by ${cancelledBy}`);

    return { message: 'Booking cancelled successfully' };
  }

  // =========================================================================
  // NOTES & DAMAGE
  // =========================================================================

  async addNote(tenantId: string, bookingId: string, note: string) {
    const booking = await this.findBookingOrFail(tenantId, bookingId);

    const updatedNotes = booking.internalNotes
      ? `${booking.internalNotes}\n\n---\n${note}`
      : note;

    await this.prisma.booking.update({
      where: { id: bookingId, tenantId },
      data: { internalNotes: updatedNotes },
    });

    return { message: 'Note added' };
  }

  async reportDamage(
    tenantId: string,
    bookingId: string,
    itemId: string,
    dto: CreateDamageReportDto,
    reportedBy: string,
  ) {
    // Verify booking item belongs to this tenant/booking
    const item = await this.prisma.bookingItem.findFirst({
      where: { id: itemId, bookingId, tenantId },
    });
    if (!item) throw new NotFoundException('Booking item not found');

    // Check booking is in inspected state (only report damage after returned/inspected)
    const booking = await this.findBookingOrFail(tenantId, bookingId);
    if (!['returned', 'inspected'].includes(booking.status)) {
      throw new UnprocessableEntityException(
        'Damage reports can only be created for returned or inspected bookings',
      );
    }

    const report = await this.prisma.damageReport.upsert({
      where: { bookingItemId: itemId },
      create: {
        tenantId,
        bookingItemId: itemId,
        damageLevel: dto.damageLevel as DamageLevel,
        description: dto.description,
        estimatedRepairCost: dto.estimatedRepairCost ?? null,
        deductionAmount: dto.deductionAmount,
        additionalCharge: dto.additionalCharge,
        photos: dto.photos ?? [],
        reportedBy,
      },
      update: {
        damageLevel: dto.damageLevel as DamageLevel,
        description: dto.description,
        estimatedRepairCost: dto.estimatedRepairCost ?? null,
        deductionAmount: dto.deductionAmount,
        additionalCharge: dto.additionalCharge,
        photos: dto.photos ?? [],
        reportedBy,
      },
    });

    this.eventEmitter.emit('booking.damage_reported', {
      tenantId,
      bookingId,
      itemId,
      damageLevel: dto.damageLevel,
    });

    return report;
  }

  // =========================================================================
  // LATE FEE CALCULATION
  // =========================================================================

  async calculateLateFees(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        items: {
          include: {
            product: {
              include: { pricing: true },
            },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updates: Promise<unknown>[] = [];

    for (const item of booking.items) {
      const expectedReturnDate = new Date(item.endDate);
      if (today <= expectedReturnDate) continue; // Not late

      const lateDays = Math.floor(
        (today.getTime() - expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (lateDays <= 0) continue;

      const pricing = item.product?.pricing;
      let lateFee = 0;

      if (pricing?.lateFeeType === 'fixed' && pricing.lateFeeAmount) {
        lateFee = pricing.lateFeeAmount * lateDays;
      } else if (pricing?.lateFeeType === 'percentage' && pricing.lateFeePercentage) {
        // Percentage of base rental per day
        const pct = Number(pricing.lateFeePercentage) / 100;
        lateFee = Math.ceil(item.baseRental * pct * lateDays);
      }

      // Cap late fee
      if (pricing?.maxLateFee && lateFee > pricing.maxLateFee) {
        lateFee = pricing.maxLateFee;
      }

      updates.push(
        this.prisma.bookingItem.update({
          where: { id: item.id },
          data: { lateDays, lateFee },
        }),
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return { bookingId, lateItemsUpdated: updates.length };
  }

  // =========================================================================
  // MANUAL DATE BLOCKING
  // =========================================================================

  async blockDates(tenantId: string, dto: BlockDatesDto) {
    // Validate product belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for conflicts with existing blocks
    const conflict = await this.prisma.dateBlock.findFirst({
      where: {
        tenantId,
        productId: dto.productId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (conflict) {
      throw new ConflictException('These dates conflict with an existing booking or block');
    }

    const block = await this.prisma.dateBlock.create({
      data: {
        tenantId,
        productId: dto.productId,
        startDate,
        endDate,
        blockType: 'manual',
        reason: dto.reason ?? null,
      },
    });

    return block;
  }

  async unblockDates(tenantId: string, blockId: string) {
    const block = await this.prisma.dateBlock.findFirst({
      where: { id: blockId, tenantId },
    });
    if (!block) throw new NotFoundException('Date block not found');

    if (block.blockType !== 'manual') {
      throw new UnprocessableEntityException(
        'Only manual date blocks can be removed. To release a booking block, cancel the booking.',
      );
    }

    await this.prisma.dateBlock.delete({ where: { id: blockId } });
    return { message: 'Date block removed' };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async findBookingOrFail(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  /**
   * Validates a single cart item: checks availability + calculates prices.
   * Used by validateCart (pre-checkout preview — no locking needed).
   */
  private async validateSingleItem(
    tenantId: string,
    item: CartItemDto,
  ): Promise<CartItemResult> {
    return this.validateSingleItemTx(this.prisma, tenantId, item);
  }

  /**
   * Validates a single cart item within a transaction client.
   * When called inside a Serializable transaction, concurrent reads on
   * the same DateBlock rows will cause one transaction to abort and retry,
   * preventing double-booking.
   */
  private async validateSingleItemTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    item: CartItemDto,
  ): Promise<CartItemResult> {
    const errors: string[] = [];

    // Load product with pricing and services
    const product = await tx.product.findFirst({
      where: { id: item.productId, tenantId, deletedAt: null },
      include: {
        pricing: true,
        services: true,
        variants: {
          where: { id: item.variantId },
          include: {
            mainColor: { select: { name: true } },
            images: { where: { isFeatured: true }, take: 1 },
          },
        },
      },
    });

    if (!product) {
      return {
        productId: item.productId,
        variantId: item.variantId,
        available: false,
        productName: 'Unknown Product',
        variantName: null,
        colorName: '',
        featuredImageUrl: '',
        errors: ['Product not found'],
        baseRental: 0,
        extendedDays: 0,
        extendedCost: 0,
        depositAmount: 0,
        cleaningFee: 0,
        backupSizeFee: 0,
        tryOnFee: 0,
        shippingFee: 0,
        itemTotal: 0,
        rentalDays: 0,
      };
    }

    if (product.status !== 'published' || !product.isAvailable) {
      errors.push('Product is not currently available for rental');
    }

    const variant = product.variants[0];
    if (!variant) {
      errors.push('Variant not found');
    }

    // Validate date range
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) errors.push('Start date cannot be in the past');
    if (start > end) errors.push('End date must be after start date');

    // Check availability (if dates are valid)
    let isAvailable = errors.length === 0;
    if (isAvailable) {
      const conflict = await tx.dateBlock.findFirst({
        where: {
          tenantId,
          productId: item.productId,
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      if (conflict) {
        isAvailable = false;
        errors.push(`Product is not available from ${item.startDate} to ${item.endDate}`);
      }
    }

    // Calculate pricing (even if unavailable — so user sees expected price)
    const pricing = this.calculatePricingForDates(product.pricing, product.services, item);

    return {
      productId: item.productId,
      variantId: item.variantId,
      available: isAvailable,
      productName: product.name,
      variantName: variant?.variantName ?? null,
      colorName: variant?.mainColor?.name ?? '',
      featuredImageUrl: variant?.images?.[0]?.url ?? '',
      errors: errors.length > 0 ? errors : undefined,
      ...pricing,
    };
  }

  /**
   * Calculates all price components for a date range.
   * ALL money values are integers (ADR-04).
   */
  private calculatePricingForDates(
    pricing: ProductPricing | null,
    services: ProductServices | null,
    item: { startDate: string; endDate: string; backupSize?: string; tryOn?: boolean },
  ): PricingSnapshot {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    const rentalDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Base rental calculation
    let baseRental = 0;
    let extendedDays = 0;
    let extendedCost = 0;

    if (pricing) {
      if (pricing.mode === 'one_time') {
        // Fixed price for included days, extended rate for extra days
        const effectivePrice = pricing.priceOverride ?? pricing.rentalPrice ?? 0;
        const includedDays = pricing.includedDays ?? rentalDays;

        if (rentalDays <= includedDays) {
          baseRental = effectivePrice;
        } else {
          baseRental = effectivePrice;
          extendedDays = rentalDays - includedDays;
          extendedCost = Math.ceil(extendedDays * (pricing.extendedRentalRate ?? 0));
        }
      } else if (pricing.mode === 'per_day') {
        const minimumDays = pricing.minimumDays ?? 1;
        baseRental = Math.ceil(Math.max(rentalDays, minimumDays) * (pricing.pricePerDay ?? 0));
      } else if (pricing.mode === 'percentage') {
        // Use calculated price (pre-computed from retailPrice * percentage)
        baseRental = pricing.priceOverride ?? pricing.calculatedPrice ?? 0;
      }
    }

    // Service fees (snapshot from ProductServices)
    const depositAmount = services?.depositAmount ?? 0;
    const cleaningFee = services?.cleaningFee ?? 0;
    const backupSizeFee = item.backupSize && services?.backupSizeEnabled ? (services?.backupSizeFee ?? 0) : 0;
    const tryOnFee = item.tryOn && services?.tryOnEnabled ? (services?.tryOnFee ?? 0) : 0;

    // Shipping fee from product pricing
    const shippingFee =
      pricing?.shippingMode === 'flat' ? (pricing?.shippingFee ?? 0) : 0;

    const itemTotal = baseRental + extendedCost + cleaningFee + backupSizeFee + tryOnFee;

    return {
      rentalDays,
      baseRental,
      extendedDays,
      extendedCost,
      depositAmount,
      cleaningFee,
      backupSizeFee,
      tryOnFee,
      shippingFee,
      itemTotal,
    };
  }

  /**
   * Compute booking-level summary from validated item results.
   */
  private computeSummary(items: CartItemResult[]): CartSummary {
    const subtotal = items.reduce((sum, i) => sum + i.baseRental + i.extendedCost, 0);
    const totalFees = items.reduce((sum, i) => sum + i.cleaningFee + i.backupSizeFee + i.tryOnFee, 0);
    const totalDeposit = items.reduce((sum, i) => sum + i.depositAmount, 0);
    // Take max shippingFee (one delivery charge covers all items)
    const shippingFee = items.reduce((max, i) => Math.max(max, i.shippingFee), 0);
    const grandTotal = subtotal + totalFees + shippingFee + totalDeposit;

    return { subtotal, totalFees, totalDeposit, shippingFee, grandTotal };
  }

  /**
   * Generates a unique booking number: #ORD-{YYYY}-{NNNN}.
   * Must be called inside a transaction for atomicity.
   */
  private async generateBookingNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    year: number,
  ): Promise<string> {
    // Use FOR UPDATE to prevent concurrent reads from generating the same number.
    // This row-level lock ensures only one transaction reads the latest booking at a time.
    const prefix = `#ORD-${year}-`;
    const result = await tx.$queryRaw<Array<{ booking_number: string | null }>>(
      Prisma.sql`SELECT booking_number FROM bookings
        WHERE tenant_id = ${tenantId}
          AND booking_number LIKE ${prefix + '%'}
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
    );

    let sequence = 1;
    const latestNumber = result[0]?.booking_number;
    if (latestNumber) {
      const parts = latestNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    const padded = String(sequence).padStart(4, '0');
    return `${prefix}${padded}`;
  }

  /**
   * Updates product and customer stats when a booking is completed.
   * Called via direct update (not event) since this is in the same module.
   */
  private async updateStatsOnCompletion(
    tenantId: string,
    bookingId: string,
    booking: { customerId: string; grandTotal: number },
  ) {
    const items = await this.prisma.bookingItem.findMany({
      where: { bookingId },
      select: { productId: true, baseRental: true, extendedCost: true },
    });

    // Update product stats (skip items where product was permanently deleted)
    const itemsWithProduct = items.filter((item) => item.productId !== null);
    await Promise.all(
      itemsWithProduct.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId! },
          data: {
            totalBookings: { increment: 1 },
            totalRevenue: { increment: item.baseRental + item.extendedCost },
          },
        }),
      ),
    );

    // Update customer stats
    await this.customerService.incrementTotalSpent(
      booking.customerId,
      booking.grandTotal,
      tenantId,
    );
  }
}
