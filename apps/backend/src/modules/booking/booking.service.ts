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
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { BookingStatus, CancelledBy, DamageLevel, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import type { ProductPricing, ProductServices } from '@prisma/client';
import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { InventoryReservationService } from '../inventory/inventory-reservation.service';
import {
  CreateBookingDto,
  ValidateCartDto,
  CartItemDto,
  BookingQueryDto,
  BlockDatesDto,
  CreateDamageReportDto,
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
  variantSizeId: string;
  sizeLabel: string;
  quantity: number;
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
  confirmed: ['delivered', 'cancelled'],
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
    private readonly pricingEngineService: PricingEngineService,
    private readonly inventoryAvailability: InventoryAvailabilityService,
    private readonly inventoryReservations: InventoryReservationService,
  ) {}

  // =========================================================================
  // AVAILABILITY
  // =========================================================================

  /**
   * Checks if a specific date range is available for a product.
   * Returns availability status + calculated pricing.
   */
  async checkDateRange(
    tenantId: string,
    productId: string,
    variantSizeId: string,
    startDate: string,
    endDate: string,
    quantity = 1,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, status: 'published', isAvailable: true, deletedAt: null },
      include: { pricing: true, services: true },
    });

    if (!product) {
      return { available: false, reason: 'Product not available' };
    }

    const inventory = await this.inventoryAvailability.check({
      tenantId,
      productId,
      variantSizeId,
      startDate,
      endDate,
      quantity,
    });
    if (!inventory.available) return inventory;

    // Calculate pricing
    const pricing = await this.calculatePricingForDates(
      product.id,
      product.pricing,
      product.services,
      {
        startDate,
        endDate,
        backupSize: undefined,
        tryOn: false,
      }
    );

    // M3 FIX: Guard against products with no pricing configured
    if (pricing.baseRental === 0 && pricing.itemTotal === 0) {
      return {
        available: false,
        reason: 'Product pricing not configured',
      };
    }

    return {
      available: true,
      inventory,
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
        variantSizeId: item.variantSizeId,
        quantity: item.quantity,
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
   * 2. Re-validate all items (with optional price overrides)
   * 3. Generate booking number
   * 4. Apply discount if provided (flat or percentage)
   * 5. Create Booking + BookingItems + inventory reservations in one transaction
   * 6. Optionally auto-confirm (skip pending state)
   * 7. Optionally record initial payment
   * 8. Emit booking.created (and booking.confirmed) event
   */
  async createBooking(tenantId: string, dto: CreateBookingDto) {
    const pendingReservationExpiresAt = dto.autoConfirm
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
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

    // Steps 2-7: Validate + create atomically inside a single transaction
    // The deterministic SKU locks and reservation writes share one serializable
    // transaction, so concurrent requests cannot both consume the same capacity.
    const booking = await this.runSerializableTransaction(async (tx) => {
      await this.inventoryReservations.lockVariantSizes(
        tx,
        tenantId,
        dto.items.map((item) => item.variantSizeId),
      );

      // Step 2: Validate all items INSIDE the transaction
      const validatedItems: CartItemResult[] = [];
      for (const item of dto.items) {
        const result = await this.validateSingleItemTx(tx, tenantId, item);
        if (!result.available) {
          throw new ConflictException(
            `Product "${result.productName}" is not available for the selected dates: ${item.startDate} – ${item.endDate}`,
          );
        }

        // Apply per-item price override if provided (manual booking power-up)
        if ('priceOverride' in item && item.priceOverride !== undefined && item.priceOverride !== null) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
            include: { pricing: true },
          });
          const minPrice = product?.pricing?.minInternalPrice ?? 0;

          if (item.priceOverride < minPrice && minPrice > 0) {
            // Soft warn — allow but log it for audit
            this.logger.warn(
              `Price override ৳${item.priceOverride} is below minInternalPrice ৳${minPrice} ` +
              `for product "${result.productName}" (tenant: ${tenantId}). Allowing with audit flag.`,
            );
          }

          // Override the base rental and recalculate item total
          const originalBaseRental = result.baseRental;
          result.baseRental = item.priceOverride;
          result.extendedDays = 0;
          result.extendedCost = 0;
          result.itemTotal = result.baseRental + result.cleaningFee + result.backupSizeFee + result.tryOnFee;
          this.logger.log(
            `Price override applied for "${result.productName}": ৳${originalBaseRental} → ৳${item.priceOverride}`,
          );
        }

        validatedItems.push(result);
      }

      const summary = this.computeSummary(validatedItems);

      // Step 3: Generate booking number (with row-level locking)
      const year = new Date().getFullYear();
      const bookingNumber = await this.generateBookingNumber(tx, tenantId, year);

      // Step 4: Apply discount if provided
      let discountAmount = 0;
      let discountType: string | null = null;
      let discountReason: string | null = null;

      if (dto.discount) {
        discountType = dto.discount.type;
        discountReason = dto.discount.reason ?? null;

        if (dto.discount.type === 'flat') {
          discountAmount = Math.min(dto.discount.value, summary.grandTotal);
        } else if (dto.discount.type === 'percentage') {
          const pct = Math.min(dto.discount.value, 100);
          discountAmount = Math.ceil((summary.subtotal + summary.totalFees) * (pct / 100));
          discountAmount = Math.min(discountAmount, summary.grandTotal);
        }

        if (discountAmount < 0) discountAmount = 0;
      }

      const grandTotalAfterDiscount = summary.grandTotal - discountAmount;

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

      // Resolve delivery recipient (may differ from customer)
      const deliveryName = dto.delivery.deliveryName || dto.customer.fullName;
      const deliveryPhone = dto.delivery.deliveryPhone || dto.customer.phone;
      const deliveryAltPhone = dto.delivery.deliveryAltPhone || dto.customer.altPhone || null;

      // Determine initial status (auto-confirm power-up)
      const initialStatus = dto.autoConfirm ? 'confirmed' : 'pending';
      const now = new Date();

      // Step 5: Create booking
      const newBooking = await tx.booking.create({
        data: {
          tenantId,
          bookingNumber,
          customerId: customer.id,
          status: initialStatus,
          paymentMethod: dto.paymentMethod as PaymentMethod,
          paymentStatus: 'unpaid',
          subtotal: summary.subtotal,
          totalFees: summary.totalFees,
          shippingFee: summary.shippingFee,
          totalDeposit: summary.totalDeposit,
          grandTotal: grandTotalAfterDiscount,
          totalPaid: 0,
          discountAmount,
          discountType,
          discountReason,
          deliveryName,
          deliveryPhone,
          deliveryAltPhone,
          deliveryAddressLine1: dto.delivery.address,
          deliveryAddressLine2: null,
          deliveryCity: dto.delivery.city ?? dto.delivery.district ?? '',
          deliveryState: dto.delivery.state ?? null,
          deliveryPostalCode: dto.delivery.postalCode ?? null,
          deliveryCountry: dto.delivery.country ?? 'BD',
          deliveryExtra: Object.keys(deliveryExtra).length > 0 ? deliveryExtra : Prisma.DbNull,
          customerNotes: dto.customerNotes ?? null,
          internalNotes: dto.internalNotes ?? null,
          // Set confirmedAt when auto-confirming
          ...(dto.autoConfirm ? { confirmedAt: now } : {}),
        },
      });

      // Create booking items + inventory reservations
      for (const [itemIndex, item] of validatedItems.entries()) {
        const cartItem = dto.items[itemIndex];

        // Build sizeInfo string from selectedSize
        const sizeInfo = item.sizeLabel || cartItem.selectedSize || null;

        // Create booking item
        // M1 FIX: Credit try-on fee toward rental when tryOnCreditToRental is enabled
        const productServices = await tx.productServices.findUnique({
          where: { productId: item.productId },
          select: { tryOnCreditToRental: true },
        });
        let effectiveTryOnFee = item.tryOnFee;
        let adjustedItemTotal = item.itemTotal;
        if (effectiveTryOnFee > 0 && productServices?.tryOnCreditToRental === true) {
          // Try-on fee is credited toward the rental, reducing the itemTotal
          adjustedItemTotal = Math.max(0, item.itemTotal - effectiveTryOnFee);
          effectiveTryOnFee = 0; // Fee was credited, so effective charge is 0
        }

        const bookingItem = await tx.bookingItem.create({
          data: {
            tenantId,
            bookingId: newBooking.id,
            productId: item.productId,
            variantId: item.variantId,
            variantSizeId: item.variantSizeId,
            quantity: item.quantity,
            productName: item.productName,
            variantName: item.variantName ?? null,
            colorName: item.colorName,
            sizeInfo,
            featuredImageUrl: item.featuredImageUrl,
            startDate: new Date(cartItem.startDate),
            endDate: new Date(cartItem.endDate),
            rentalDays: item.rentalDays,
            baseRental: item.baseRental,
            extendedDays: item.extendedDays,
            extendedCost: item.extendedCost,
            depositAmount: item.depositAmount,
            depositStatus: 'pending',
            cleaningFee: item.cleaningFee,
            backupSize: cartItem.backupSize ?? null,
            backupSizeFee: item.backupSizeFee,
            tryOnFee: effectiveTryOnFee,
            itemTotal: adjustedItemTotal,
            lateFee: 0,
            lateDays: 0,
          },
        });

        await this.inventoryReservations.create(tx, {
          tenantId,
          bookingId: newBooking.id,
          bookingItemId: bookingItem.id,
          productId: item.productId,
          variantSizeId: item.variantSizeId,
          quantity: item.quantity,
          startDate: cartItem.startDate,
          endDate: cartItem.endDate,
          status: dto.autoConfirm ? 'CONFIRMED' : 'PENDING',
          expiresAt: pendingReservationExpiresAt,
        });
      }

      // Step 7: Record initial payment if provided
      if (dto.initialPayment) {
        const paymentAmount = Math.min(dto.initialPayment.amount, grandTotalAfterDiscount);
        await tx.payment.create({
          data: {
            tenantId,
            bookingId: newBooking.id,
            amount: paymentAmount,
            method: dto.initialPayment.method as PaymentMethod,
            status: 'verified',
            transactionId: dto.initialPayment.transactionId ?? null,
            notes: dto.initialPayment.notes ?? 'Initial payment recorded at booking creation',
            verifiedAt: now,
          },
        });

        // Update booking totalPaid and paymentStatus
        const newPaymentStatus = paymentAmount >= grandTotalAfterDiscount ? 'paid' : 'partial';
        await tx.booking.update({
          where: { id: newBooking.id },
          data: {
            totalPaid: paymentAmount,
            paymentStatus: newPaymentStatus,
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
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
            },
          },
        },
      });
    });

    if (!booking) throw new UnprocessableEntityException('Failed to create booking');

    // Step 8: Emit events (ADR-05)
    this.eventEmitter.emit('booking.created', {
      tenantId,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      grandTotal: booking.grandTotal,
    });

    // If auto-confirmed, also emit the confirmed event
    if (dto.autoConfirm) {
      this.eventEmitter.emit('booking.confirmed', {
        tenantId,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
      });
    }

    this.logger.log(
      `Booking created: ${booking.bookingNumber} (tenant: ${tenantId})` +
      `${dto.autoConfirm ? ' [auto-confirmed]' : ''}` +
      `${dto.discount ? ` [discount: ${dto.discount.type} ${dto.discount.value}]` : ''}` +
      `${dto.initialPayment ? ` [initial payment: ৳${dto.initialPayment.amount}]` : ''}`,
    );

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
        discountAmount: booking.discountAmount,
        grandTotal: booking.grandTotal,
      },
      customer: booking.customer,
      items: booking.items,
      payments: booking.payments,
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
            variantSize: { include: { sizeInstance: true } },
            inventoryReservation: {
              include: {
                assignments: {
                  where: { releasedAt: null },
                  include: { stockUnit: true },
                },
              },
            },
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
            status: 'confirmed',
            courierStatus: { in: ['in_transit', 'out_for_delivery', 'at_destination'] },
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
            status: { in: ['pending', 'confirmed', 'delivered'] },
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
          _sum: { grandTotal: true, totalDeposit: true }, // M2 FIX: also sum deposits to exclude from revenue
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
      revenueThisMonth: Math.max(0, (revenueAgg._sum.grandTotal || 0) - (revenueAgg._sum.totalDeposit || 0)),
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

    const updated = await this.prisma.$transaction(async (tx) => {
      // Keep legacy booking blocks synchronized while they still exist.
      if (newStatus === 'confirmed') {
        await tx.dateBlock.updateMany({
          where: { bookingId, tenantId, blockType: 'pending' },
          data: { blockType: 'booking' },
        });
      }
      await this.inventoryReservations.transitionForBooking(
        tx,
        tenantId,
        bookingId,
        newStatus,
      );
      return tx.booking.update({
        where: { id: bookingId, tenantId },
        data: updateData,
      });
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
      await this.inventoryReservations.transitionForBooking(
        tx,
        tenantId,
        bookingId,
        'cancelled',
        dto.reason,
      );
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

    if (dto.stockUnitIssueId) {
      const issue = await this.prisma.stockUnitIssue.findFirst({
        where: {
          id: dto.stockUnitIssueId,
          tenantId,
          bookingItemId: itemId,
        },
        select: { id: true },
      });
      if (!issue) {
        throw new NotFoundException('Damage issue was not found for this booking item');
      }
    }

    const report = await this.prisma.damageReport.upsert({
      where: { bookingItemId: itemId },
      create: {
        tenantId,
        bookingItemId: itemId,
        stockUnitIssueId: dto.stockUnitIssueId ?? null,
        damageLevel: dto.damageLevel as DamageLevel,
        description: dto.description,
        estimatedRepairCost: dto.estimatedRepairCost ?? null,
        deductionAmount: dto.deductionAmount,
        additionalCharge: dto.additionalCharge,
        photos: dto.photos ?? [],
        reportedBy,
      },
      update: {
        stockUnitIssueId: dto.stockUnitIssueId ?? null,
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
              include: {
                pricing: true,
                // M5 FIX: Also load pricing profile for new engine late fees
                pricingProfile: {
                  include: {
                    policyVersions: {
                      where: { status: 'ACTIVE' },
                      take: 1,
                    },
                  },
                },
              },
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

      let lateFee = 0;

      // M5 FIX: Try new pricing engine's late fee policy first
      const activeVersion = (item.product as any)?.pricingProfile?.policyVersions?.[0];
      if (activeVersion?.lateFeePolicy) {
        // Use pricing engine's computeLateFee
        lateFee = this.pricingEngineService.computeLateFee(
          activeVersion.lateFeePolicy,
          item.baseRental,
          lateDays,
        );
      } else {
        // Fall back to legacy ProductPricing late fee
        const pricing = item.product?.pricing;
        if (pricing?.lateFeeType === 'fixed' && pricing.lateFeeAmount) {
          lateFee = pricing.lateFeeAmount * lateDays;
        } else if (pricing?.lateFeeType === 'percentage' && pricing.lateFeePercentage) {
          const pct = Number(pricing.lateFeePercentage) / 100;
          lateFee = Math.ceil(item.baseRental * pct * lateDays);
        }

        // Cap late fee (legacy)
        if (pricing?.maxLateFee && lateFee > pricing.maxLateFee) {
          lateFee = pricing.maxLateFee;
        }
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
   * During booking creation the affected SKU rows are locked first and the
   * serializable transaction is retried on a write conflict.
   */
  private async validateSingleItemTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    item: CartItemDto,
  ): Promise<CartItemResult> {
    const errors: string[] = [];
    const quantity = item.quantity ?? 1;

    // Inventory identity is the tenant-owned variant-size, never a display label.
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
            sizes: {
              where: { id: item.variantSizeId },
              include: { sizeInstance: true },
            },
          },
        },
        sizeSchemaOverride: {
          include: { instances: { select: { id: true } } },
        },
        productType: {
          include: {
            defaultSizeSchema: {
              include: { instances: { select: { id: true } } },
            },
          },
        },
      },
    });

    if (!product) {
      return {
        productId: item.productId,
        variantId: item.variantId,
        variantSizeId: item.variantSizeId,
        sizeLabel: item.selectedSize ?? '',
        quantity,
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
    const variantSize = variant?.sizes[0];
    if (!variantSize) {
      errors.push('Selected size is not available for this variant');
    }

    // Validate date range
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (start < today) errors.push('Start date cannot be in the past');
    if (start > end) errors.push('End date must be after start date');

    // Backup size is still a display/service option. Primary inventory identity
    // is always variantSizeId and is validated above.
    const activeSchema = (product as any).sizeSchemaOverride ?? (product as any).productType?.defaultSizeSchema ?? null;
    const validSizeIds = activeSchema?.instances?.map((i: any) => i.id) ?? [];

    if (item.backupSize) {
      if (validSizeIds.length > 0 && !validSizeIds.includes(item.backupSize)) {
        errors.push('Backup size is not available for this product');
      }
      if (item.backupSize === variantSize?.sizeInstanceId) {
        errors.push('Backup size must differ from selected size');
      }
    }

    let isAvailable = errors.length === 0;
    if (isAvailable) {
      const inventory = await this.inventoryAvailability.check(
        {
          tenantId,
          productId: item.productId,
          variantSizeId: item.variantSizeId,
          startDate: item.startDate,
          endDate: item.endDate,
          quantity,
        },
        tx as Prisma.TransactionClient,
      );
      if (!inventory.available) {
        isAvailable = false;
        errors.push(inventory.reason ?? 'Selected inventory is not available');
      }
    }

    const unitPricing = await this.calculatePricingForDates(
      product.id,
      product.pricing,
      product.services,
      item,
    );
    const pricing: PricingSnapshot = {
      ...unitPricing,
      baseRental: unitPricing.baseRental * quantity,
      extendedCost: unitPricing.extendedCost * quantity,
      depositAmount: unitPricing.depositAmount * quantity,
      cleaningFee: unitPricing.cleaningFee * quantity,
      backupSizeFee: unitPricing.backupSizeFee * quantity,
      tryOnFee: unitPricing.tryOnFee * quantity,
      itemTotal: unitPricing.itemTotal * quantity,
    };

    return {
      productId: item.productId,
      variantId: item.variantId,
      variantSizeId: item.variantSizeId,
      sizeLabel: variantSize?.sizeInstance.displayLabel ?? item.selectedSize ?? '',
      quantity,
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
  private async calculatePricingForDates(
    productId: string,
    pricing: ProductPricing | null,
    services: ProductServices | null,
    item: { startDate: string; endDate: string; backupSize?: string; tryOn?: boolean },
  ): Promise<PricingSnapshot> {
    // 1. Try resolving using determinative pricing engine v2
    const enginePricing = await this.pricingEngineService.computeLegacyPricing(
      productId,
      item.startDate,
      item.endDate,
      { backupSize: item.backupSize, tryOn: item.tryOn }
    );
    if (enginePricing) return enginePricing;

    // 2. Fallback backward compatibility calculation if legacy product
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

    // L2 FIX: Dynamic padding — auto-expand beyond 4 digits when >9999 bookings/year
    const padLength = Math.max(4, String(sequence).length);
    const padded = String(sequence).padStart(padLength, '0');
    return `${prefix}${padded}`;
  }

  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15_000,
        });
      } catch (error) {
        const retriable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!retriable) throw error;
        if (attempt === maxAttempts) {
          throw new ConflictException({
            code: 'INVENTORY_CAPACITY_CONFLICT',
            message: 'Inventory changed while the booking was being created. Please try again.',
          });
        }
      }
    }
    throw new ConflictException('Could not reserve inventory');
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
