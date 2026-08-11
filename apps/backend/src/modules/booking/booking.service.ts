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
import { BookingChannel, BookingStatus, CancelledBy, DamageLevel, FulfillmentRequirementStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { InventoryReservationService } from '../inventory/inventory-reservation.service';
import { FulfillmentService, RequirementProposal } from '../inventory/fulfillment.service';
import type { LateFeePolicy } from '@closetrent/types';
import { createHash, randomUUID } from 'crypto';
import {
  CreateBookingDto,
  CreateManualBookingDto,
  CreateManualBookingQuoteDto,
  ValidateCartDto,
  CartItemDto,
  BookingQueryDto,
  CreateDamageReportDto,
  CancelBookingDto,
  BOOKING_LIST_MAX_LIMIT,
} from './dto/booking.dto';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface PricingSnapshot {
  policyVersionId: string;
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

export interface ManualQuoteLine {
  lineId: string;
  productId: string;
  variantId: string;
  variantSizeId: string;
  productName: string;
  quantity: number;
  rentalDays: number;
  quotedItemTotal: number;
  priceOverrideAmount: number | null;
  priceOverrideReason: string | null;
  finalItemTotal: number;
  depositAmount: number;
  fees: {
    cleaning: number;
    backupSize: number;
    tryOn: number;
    shipping: number;
  };
  policyVersionId: string;
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

type SummaryLine = Pick<
  PricingSnapshot,
  'cleaningFee' | 'backupSizeFee' | 'tryOnFee' | 'shippingFee' | 'depositAmount' | 'itemTotal'
>;

/**
 * Aggregates authoritative item totals without reconstructing the base price.
 * This preserves composition and add-on adjustments already applied by the
 * pricing/fulfillment calculation while reporting fees separately.
 */
export function computeCartSummary(items: SummaryLine[]): CartSummary {
  const totalFees = items.reduce(
    (sum, item) => sum + item.cleaningFee + item.backupSizeFee + item.tryOnFee,
    0,
  );
  const subtotal = items.reduce(
    (sum, item) =>
      sum + item.itemTotal - item.cleaningFee - item.backupSizeFee - item.tryOnFee,
    0,
  );
  const totalDeposit = items.reduce((sum, item) => sum + item.depositAmount, 0);
  const shippingFee = items.reduce((max, item) => Math.max(max, item.shippingFee), 0);
  const grandTotal = items.reduce((sum, item) => sum + item.itemTotal, 0)
    + shippingFee
    + totalDeposit;

  return { subtotal, totalFees, totalDeposit, shippingFee, grandTotal };
}

const BOOKING_CREATED_INCLUDE = {
  customer: {
    select: {
      id: true,
      fullName: true,
      identities: {
        where: { kind: 'phone' as const },
        orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
        take: 1,
        select: { value: true },
      },
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      variantSizeId: true,
      quantity: true,
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
    select: { id: true, amount: true, method: true, status: true },
  },
} satisfies Prisma.BookingInclude;

type BookingCreatedRecord = Prisma.BookingGetPayload<{
  include: typeof BOOKING_CREATED_INCLUDE;
}>;

export interface BookingOperationalTimelineEvent {
  id: string;
  category: 'BOOKING' | 'COURIER' | 'FULFILLMENT' | 'COMMERCIAL' | 'RETURN';
  code: string;
  label: string;
  occurredAt: Date | string;
  actor: { id: string; fullName: string } | null;
  reason: string | null;
  amountMinor: number | null;
  metadata?: Record<string, unknown>;
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
    private readonly fulfillment: FulfillmentService,
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
      select: { id: true },
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
    if (!inventory.available) {
      const nextAvailable = await this.inventoryAvailability.findNextAvailable({
        tenantId,
        productId,
        variantSizeId,
        startDate,
        endDate,
        quantity,
      }, inventory);
      return {
        ...inventory,
        conflictDates: [inventory.effectiveBlockedRange.start, inventory.effectiveBlockedRange.end],
        ...(nextAvailable ? { nextAvailable } : {}),
      };
    }

    // Calculate pricing
    const pricing = await this.calculatePricingForDates(
      product.id,
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
    const { results, proposalsByItem } = await this.prisma.$transaction(async (tx) => {
      const results: CartItemResult[] = [];
      const proposalsByItem: RequirementProposal[][] = [];
      const checks: Array<{
        itemIndex: number;
        proposal: RequirementProposal;
        blockedStart: string;
        blockedEnd: string;
        remainingQuantity: number;
        available: boolean;
        reason?: string;
      }> = [];

      for (const [itemIndex, item] of dto.items.entries()) {
        const result = await this.validateSingleItemTx(tx, tenantId, item);
        let proposals: RequirementProposal[] = [];
        try {
          proposals = await this.fulfillment.expandProposal(tx, {
            tenantId,
            productId: item.productId,
            variantSizeId: item.variantSizeId,
            quantity: item.quantity,
            selections: item.compositionSelections,
            preferredStockUnitId: item.preferredStockUnitId,
          });
          result.itemTotal += proposals.reduce((sum, proposal) => sum + proposal.priceAdjustment, 0);
          for (const proposal of proposals) {
            const availability = await this.inventoryAvailability.check({
              tenantId,
              productId: proposal.productId,
              variantSizeId: proposal.variantSizeId,
              preferredStockUnitId: proposal.preferredStockUnitId,
              startDate: item.startDate,
              endDate: item.endDate,
              quantity: proposal.quantity,
            }, tx);
            checks.push({
              itemIndex,
              proposal,
              blockedStart: availability.effectiveBlockedRange.start,
              blockedEnd: availability.effectiveBlockedRange.end,
              remainingQuantity: availability.remainingQuantity,
              available: availability.available,
              reason: availability.reason,
            });
          }
        } catch (error) {
          result.available = false;
          result.errors = [...(result.errors ?? []), error instanceof Error ? error.message : 'Product composition is invalid'];
        }
        results.push(result);
        proposalsByItem.push(proposals);
      }

      for (const check of checks) {
        const combinedDemand = checks
          .filter((candidate) =>
            candidate.proposal.variantSizeId === check.proposal.variantSizeId &&
            candidate.blockedStart <= check.blockedEnd &&
            candidate.blockedEnd >= check.blockedStart,
          )
          .reduce((sum, candidate) => sum + candidate.proposal.quantity, 0);
        if (!check.available || combinedDemand > check.remainingQuantity) {
          const result = results[check.itemIndex];
          result.available = false;
          result.errors = [
            ...(result.errors ?? []),
            check.reason ?? `${check.proposal.productName} does not have enough inventory for the full bundle`,
          ];
        }
      }
      return { results, proposalsByItem };
    });
    const anyUnavailable = results.some((item) => !item.available);

    const summary = computeCartSummary(results);

    const response = {
      valid: !anyUnavailable,
      items: results.map((item, itemIndex) => ({
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
        fulfillmentRequirements: proposalsByItem[itemIndex].map((proposal) => ({
          requirementKey: proposal.requirementKey,
          role: proposal.role,
          productId: proposal.productId,
          variantSizeId: proposal.variantSizeId,
          quantity: proposal.quantity,
          productName: proposal.productName,
          variantName: proposal.variantName,
          sizeLabel: proposal.sizeLabel,
          priceAdjustment: proposal.priceAdjustment,
        })),
      })),
      summary: {
        subtotal: summary.subtotal,
        totalFees: summary.totalFees,
        totalDeposit: summary.totalDeposit,
        shippingFee: summary.shippingFee,
        grandTotal: summary.grandTotal,
      },
    };

    if (!dto.issueCheckoutQuote || !response.valid) return response;

    const id = randomUUID();
    const requestHash = this.canonicalHash(dto.items);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const quoteHash = this.canonicalHash({
      id,
      tenantId,
      requestHash,
      response,
      expiresAt: expiresAt.toISOString(),
    });
    await this.prisma.storefrontCheckoutQuote.create({
      data: {
        id,
        tenantId,
        requestHash,
        quoteHash,
        requestSnapshot: dto.items as unknown as Prisma.InputJsonValue,
        responseSnapshot: response as unknown as Prisma.InputJsonValue,
        grandTotal: summary.grandTotal,
        expiresAt,
      },
    });

    return {
      ...response,
      checkoutQuote: {
        id,
        quoteHash,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  // =========================================================================
  // BOOKING CREATION (ATOMIC)
  // =========================================================================

  async createManualQuote(
    tenantId: string,
    dto: CreateManualBookingQuoteDto,
    actorUserId?: string,
  ) {
    const normalizedItems = dto.items.map((item) => ({
      ...item,
      startDate: dto.plan.startDate,
      endDate: dto.plan.endDate,
    }));
    if (dto.items.some((item) => item.startDate !== dto.plan.startDate || item.endDate !== dto.plan.endDate)) {
      throw new BadRequestException('Every item must use the rental-plan dates');
    }

    return this.prisma.$transaction(async (tx) => {
      const location = await tx.inventoryLocation.findFirst({
        where: {
          id: dto.plan.sourceLocationId,
          tenantId,
          isActive: true,
          canStoreInventory: true,
          canFulfillRentals: true,
        },
        select: { id: true, code: true, name: true, canCustomerPickup: true },
      });
      if (!location) throw new BadRequestException('Select an active rental fulfillment location');
      if (dto.plan.handoverMethod === 'CUSTOMER_PICKUP' && !location.canCustomerPickup) {
        throw new BadRequestException('The selected location does not support customer pickup');
      }

      const results: CartItemResult[] = [];
      const lines: ManualQuoteLine[] = [];
      const policyVersionIds = new Set<string>();
      const availabilityPlan: Array<Record<string, unknown>> = [];
      const conflicts: Array<Record<string, unknown>> = [];
      const checks: Array<{
        lineId: string;
        variantSizeId: string;
        quantity: number;
        blockedStart: string;
        blockedEnd: string;
        remainingQuantity: number;
        available: boolean;
        reason?: string;
      }> = [];

      for (const [index, item] of normalizedItems.entries()) {
        const lineId = `${index}:${item.variantSizeId}`;
        const proposals = await this.fulfillment.expandProposal(tx, {
          tenantId,
          productId: item.productId,
          variantSizeId: item.variantSizeId,
          preferredStockUnitId: item.preferredStockUnitId,
          quantity: item.quantity,
          selections: item.compositionSelections,
        });
        const result = await this.validateSingleItemTx(tx, tenantId, item, location.id);
        result.itemTotal += proposals.reduce((sum, proposal) => sum + proposal.priceAdjustment, 0);
        const quotedItemTotal = result.itemTotal;

        if (item.priceOverride !== undefined) {
          if (item.priceOverride > 100_000_000) {
            throw new BadRequestException('A price override cannot exceed ৳1,000,000');
          }
          result.baseRental = item.priceOverride;
          result.extendedDays = 0;
          result.extendedCost = 0;
          result.itemTotal = item.priceOverride
            + result.cleaningFee
            + result.backupSizeFee
            + result.tryOnFee
            + proposals.reduce((sum, proposal) => sum + proposal.priceAdjustment, 0);
        }
        if (dto.plan.handoverMethod === 'CUSTOMER_PICKUP') result.shippingFee = 0;
        results.push(result);
        policyVersionIds.add(result.policyVersionId);

        lines.push({
          lineId,
          productId: result.productId,
          variantId: result.variantId,
          variantSizeId: result.variantSizeId,
          productName: result.productName,
          quantity: result.quantity,
          rentalDays: result.rentalDays,
          quotedItemTotal,
          priceOverrideAmount: item.priceOverride ?? null,
          priceOverrideReason: item.priceOverrideReason?.trim() ?? null,
          finalItemTotal: result.itemTotal,
          depositAmount: result.depositAmount,
          fees: {
            cleaning: result.cleaningFee,
            backupSize: result.backupSizeFee,
            tryOn: result.tryOnFee,
            shipping: result.shippingFee,
          },
          policyVersionId: result.policyVersionId,
        });

        if (!result.available) {
          conflicts.push({
            code: 'LINE_UNAVAILABLE',
            lineId,
            productId: item.productId,
            variantSizeId: item.variantSizeId,
            message: result.errors?.join('. ') ?? 'The selected item is unavailable',
          });
        }

        for (const proposal of proposals) {
          const availability = await this.inventoryAvailability.check({
            tenantId,
            productId: proposal.productId,
            variantSizeId: proposal.variantSizeId,
            preferredStockUnitId: proposal.preferredStockUnitId,
            sourceLocationId: location.id,
            startDate: dto.plan.startDate,
            endDate: dto.plan.endDate,
            quantity: proposal.quantity,
            enforcePublished: false,
          }, tx);
          const planEntry: Record<string, unknown> = {
            lineId,
            requirementKey: proposal.requirementKey,
            productId: proposal.productId,
            variantSizeId: proposal.variantSizeId,
            quantity: proposal.quantity,
            sourceLocationId: availability.sourceLocationId,
            sourceLocationName: availability.sourceLocation?.name ?? location.name,
            trackingMode: availability.trackingMode,
            blockedRange: availability.effectiveBlockedRange,
            remainingQuantity: availability.remainingQuantity,
            transferRequired: false,
          };
          if (!availability.available && dto.plan.allowTransferPlan) {
            const alternate = await this.inventoryAvailability.check({
              tenantId,
              productId: proposal.productId,
              variantSizeId: proposal.variantSizeId,
              preferredStockUnitId: proposal.preferredStockUnitId,
              startDate: dto.plan.startDate,
              endDate: dto.plan.endDate,
              quantity: proposal.quantity,
              enforcePublished: false,
            }, tx);
            if (alternate.available && alternate.sourceLocationId !== location.id) {
              planEntry.transferRequired = true;
              planEntry.transferFromLocationId = alternate.sourceLocationId;
              planEntry.transferFromLocationName = alternate.sourceLocation?.name;
            }
          }
          availabilityPlan.push(planEntry);
          checks.push({
            lineId,
            variantSizeId: proposal.variantSizeId,
            quantity: proposal.quantity,
            blockedStart: availability.effectiveBlockedRange.start,
            blockedEnd: availability.effectiveBlockedRange.end,
            remainingQuantity: availability.remainingQuantity,
            available: availability.available,
            reason: availability.reason,
          });
        }
      }

      for (const check of checks) {
        const combinedDemand = checks
          .filter((candidate) =>
            candidate.variantSizeId === check.variantSizeId
            && candidate.blockedStart <= check.blockedEnd
            && candidate.blockedEnd >= check.blockedStart,
          )
          .reduce((sum, candidate) => sum + candidate.quantity, 0);
        if (!check.available || combinedDemand > check.remainingQuantity) {
          if (!conflicts.some((conflict) => conflict.lineId === check.lineId && conflict.code === 'CAPACITY_CHANGED')) {
            const planEntry = availabilityPlan.find((entry) => entry.lineId === check.lineId && entry.variantSizeId === check.variantSizeId);
            conflicts.push({
              code: 'CAPACITY_CHANGED',
              lineId: check.lineId,
              variantSizeId: check.variantSizeId,
              requestedQuantity: combinedDemand,
              remainingQuantity: check.remainingQuantity,
              transferRequired: planEntry?.transferRequired === true,
              transferFromLocationId: planEntry?.transferFromLocationId,
              message: check.reason ?? 'The selected location cannot satisfy the complete rental plan',
            });
          }
        }
      }

      const summary = computeCartSummary(results);
      const discountAmount = this.computeDiscountAmount(dto.discount, summary);
      const totals = { ...summary, discountAmount, grandTotal: summary.grandTotal - discountAmount };
      const requestSnapshot = {
        plan: dto.plan,
        items: normalizedItems,
        discount: dto.discount ?? null,
      };
      const inputsHash = this.canonicalHash(requestSnapshot);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const quoteHash = this.canonicalHash({
        inputsHash,
        policyVersionIds: [...policyVersionIds].sort(),
        lines,
        availabilityPlan,
        totals,
        expiresAt: expiresAt.toISOString(),
      });

      if (conflicts.length > 0) {
        return {
          valid: false,
          quoteId: null,
          quoteHash: null,
          expiresAt: null,
          location,
          plan: dto.plan,
          lines,
          availabilityPlan,
          totals,
          conflicts,
        };
      }

      const quote = await tx.bookingQuote.create({
        data: {
          tenantId,
          inputsHash,
          quoteHash,
          sourceLocationId: location.id,
          rentalStartDate: new Date(dto.plan.startDate),
          rentalEndDate: new Date(dto.plan.endDate),
          handoverMethod: dto.plan.handoverMethod,
          returnMethod: dto.plan.returnMethod,
          requestSnapshot: requestSnapshot as unknown as Prisma.InputJsonValue,
          itemizedLines: lines as unknown as Prisma.InputJsonValue,
          availabilityPlan: availabilityPlan as unknown as Prisma.InputJsonValue,
          policyVersionIds: [...policyVersionIds].sort(),
          subtotal: totals.subtotal,
          totalFees: totals.totalFees,
          shippingFee: totals.shippingFee,
          totalDeposit: totals.totalDeposit,
          discountAmount,
          grandTotal: totals.grandTotal,
          expiresAt,
          createdByUserId: actorUserId ?? null,
        },
      });
      return {
        valid: true,
        quoteId: quote.id,
        quoteHash,
        expiresAt: expiresAt.toISOString(),
        location,
        plan: dto.plan,
        lines,
        availabilityPlan,
        totals,
        conflicts: [],
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async createGuestBooking(tenantId: string, dto: CreateBookingDto, creationKey?: string) {
    if (
      dto.autoConfirm
      || dto.initialPayment
      || dto.discount
      || dto.internalNotes
      || dto.items.some((item) => item.priceOverride !== undefined)
    ) {
      throw new BadRequestException('Owner-only booking controls are not accepted by the storefront endpoint');
    }
    if (!creationKey?.trim()) {
      throw new BadRequestException('Idempotency-Key is required for storefront booking creation');
    }
    if (!dto.checkoutQuoteId || !dto.checkoutQuoteHash) {
      throw new BadRequestException('A current checkout quote is required');
    }
    const store = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        bkashNumber: true,
        nagadNumber: true,
        sslcommerzStoreId: true,
        sslcommerzStorePass: true,
      },
    });
    if (dto.paymentMethod === 'bkash' && !store?.bkashNumber) {
      throw new BadRequestException('bKash is not configured for this store');
    }
    if (dto.paymentMethod === 'nagad' && !store?.nagadNumber) {
      throw new BadRequestException('Nagad is not configured for this store');
    }
    if (dto.paymentMethod === 'sslcommerz' && (!store?.sslcommerzStoreId || !store.sslcommerzStorePass)) {
      throw new BadRequestException('Online card payment is not configured for this store');
    }
    return this.createBooking(tenantId, dto, creationKey);
  }

  async createManualBooking(
    tenantId: string,
    dto: CreateManualBookingDto,
    creationKey?: string,
  ) {
    if (!creationKey?.trim()) throw new BadRequestException('Idempotency-Key is required for manual booking creation');
    return this.createBooking(tenantId, dto, creationKey);
  }

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
  async createBooking(tenantId: string, dto: CreateBookingDto, rawCreationKey?: string) {
    const manualDto = 'quoteId' in dto ? dto as CreateManualBookingDto : null;
    const storefrontQuoteId = manualDto ? null : dto.checkoutQuoteId ?? null;
    const creationKey = rawCreationKey?.trim() || null;
    const creationRequestHash = creationKey ? this.bookingRequestHash(dto) : null;
    if (creationKey && creationKey.length > 200) {
      throw new BadRequestException('Idempotency-Key cannot exceed 200 characters');
    }
    if (creationKey) {
      const existing = await this.prisma.booking.findFirst({
        where: { tenantId, creationKey },
        include: BOOKING_CREATED_INCLUDE,
      });
      if (existing) {
        this.assertMatchingBookingRequest(existing, creationRequestHash);
        return this.toBookingCreatedResponse(existing);
      }
    }
    let acceptedQuote = null;
    if (manualDto) {
      if (manualDto.items.some((item) => item.startDate !== manualDto.plan.startDate || item.endDate !== manualDto.plan.endDate)) {
        throw new BadRequestException('Every item must use the accepted rental-plan dates');
      }
      acceptedQuote = await this.prisma.bookingQuote.findFirst({
        where: { id: manualDto.quoteId, tenantId },
        include: { booking: { select: { id: true } } },
      });
      if (!acceptedQuote) throw new ConflictException({ code: 'QUOTE_NOT_FOUND', message: 'The accepted quote no longer exists' });
      if (acceptedQuote.booking) throw new ConflictException({ code: 'QUOTE_ALREADY_USED', message: 'This quote already created a booking' });
      if (acceptedQuote.expiresAt <= new Date()) throw new ConflictException({ code: 'QUOTE_EXPIRED', message: 'The accepted quote has expired; refresh pricing and availability' });
      if (acceptedQuote.quoteHash !== manualDto.quoteHash) {
        throw new ConflictException({ code: 'QUOTE_MISMATCH', message: 'The accepted quote identity does not match the current request' });
      }
      const inputsHash = this.canonicalHash({
        plan: manualDto.plan,
        items: manualDto.items,
        discount: manualDto.discount ?? null,
      });
      if (acceptedQuote.inputsHash !== inputsHash) {
        throw new ConflictException({ code: 'QUOTE_INPUTS_CHANGED', message: 'Rental dates, location, items, or adjustments changed after quoting' });
      }
    }
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
    let booking: BookingCreatedRecord | null;
    try {
      booking = await this.runSerializableTransaction(async (tx) => {
      let storefrontQuote: Prisma.StorefrontCheckoutQuoteGetPayload<{
        include: { booking: { select: { id: true } } };
      }> | null = null;
      if (!manualDto) {
        await tx.$queryRaw(Prisma.sql`
          SELECT id FROM storefront_checkout_quotes
          WHERE tenant_id = ${tenantId} AND id = ${storefrontQuoteId}
          FOR UPDATE
        `);
        storefrontQuote = await tx.storefrontCheckoutQuote.findFirst({
          where: { id: storefrontQuoteId ?? '', tenantId },
          include: { booking: { select: { id: true } } },
        });
        if (!storefrontQuote) {
          throw new ConflictException({ code: 'CHECKOUT_QUOTE_NOT_FOUND', message: 'The checkout quote no longer exists; refresh checkout' });
        }
        if (storefrontQuote.booking) {
          throw new ConflictException({ code: 'CHECKOUT_QUOTE_ALREADY_USED', message: 'This checkout quote has already been used' });
        }
        if (storefrontQuote.expiresAt <= new Date()) {
          throw new ConflictException({ code: 'CHECKOUT_QUOTE_EXPIRED', message: 'Prices and availability expired; refresh checkout' });
        }
        if (storefrontQuote.quoteHash !== dto.checkoutQuoteHash) {
          throw new ConflictException({ code: 'CHECKOUT_QUOTE_MISMATCH', message: 'The checkout quote identity is invalid' });
        }
        if (storefrontQuote.requestHash !== this.canonicalHash(dto.items)) {
          throw new ConflictException({ code: 'CHECKOUT_INPUTS_CHANGED', message: 'Cart items or rental dates changed after checkout was priced' });
        }
      }
      if (manualDto) {
        await tx.$queryRaw(Prisma.sql`
          SELECT id FROM booking_quotes
          WHERE tenant_id = ${tenantId} AND id = ${manualDto.quoteId}
          FOR UPDATE
        `);
        const lockedQuote = await tx.bookingQuote.findFirst({
          where: { id: manualDto.quoteId, tenantId },
          include: { booking: { select: { id: true } } },
        });
        if (!lockedQuote || lockedQuote.booking || lockedQuote.expiresAt <= new Date()) {
          throw new ConflictException({ code: 'QUOTE_STALE', message: 'The accepted quote expired or was already used' });
        }
        const currentLocation = await tx.inventoryLocation.findFirst({
          where: {
            id: manualDto.plan.sourceLocationId,
            tenantId,
            isActive: true,
            canFulfillRentals: true,
          },
          select: { id: true, name: true, canCustomerPickup: true },
        });
        if (
          !currentLocation
          || (manualDto.plan.handoverMethod === 'CUSTOMER_PICKUP' && !currentLocation.canCustomerPickup)
        ) {
          throw new ConflictException({
            code: 'FULFILLMENT_LOCATION_CHANGED',
            message: 'The selected location can no longer fulfill this handover plan; choose another location and refresh the quote',
            sourceLocationId: manualDto.plan.sourceLocationId,
          });
        }
        const quotedPolicyIds = lockedQuote.policyVersionIds as string[];
        if (quotedPolicyIds.length > 0) {
          await tx.$queryRaw(Prisma.sql`
            SELECT id FROM price_policy_versions
            WHERE id IN (${Prisma.join([...quotedPolicyIds].sort())})
            ORDER BY id
            FOR SHARE
          `);
        }
      }
      const fulfillmentProposals: RequirementProposal[][] = [];
      for (const item of dto.items) {
        fulfillmentProposals.push(await this.fulfillment.expandProposal(tx, {
          tenantId,
          productId: item.productId,
          variantSizeId: item.variantSizeId,
          preferredStockUnitId: item.preferredStockUnitId,
          quantity: item.quantity,
          selections: item.compositionSelections,
        }));
      }
      await this.fulfillment.lockProposalSkus(tx, tenantId, fulfillmentProposals.flat());

      // Step 2: Validate all items INSIDE the transaction
      const validatedItems: CartItemResult[] = [];
      const quotedItemTotals: number[] = [];
      for (const item of dto.items) {
        const result = await this.validateSingleItemTx(tx, tenantId, item, manualDto?.plan.sourceLocationId);
        if (!result.available) {
          throw new ConflictException({
            code: 'AVAILABILITY_CHANGED',
            message: `Product "${result.productName}" is no longer available for the accepted rental plan`,
            productId: item.productId,
            variantSizeId: item.variantSizeId,
            errors: result.errors,
          });
        }

        const compositionAdjustment = fulfillmentProposals[validatedItems.length]
          .reduce((sum, proposal) => sum + proposal.priceAdjustment, 0);
        result.itemTotal += compositionAdjustment;
        quotedItemTotals.push(result.itemTotal);

        // Apply per-item price override if provided (manual booking power-up)
        if ('priceOverride' in item && item.priceOverride !== undefined && item.priceOverride !== null) {
          // Override the base rental and recalculate item total
          const originalBaseRental = result.baseRental;
          result.baseRental = item.priceOverride;
          result.extendedDays = 0;
          result.extendedCost = 0;
          result.itemTotal = result.baseRental + result.cleaningFee + result.backupSizeFee + result.tryOnFee + compositionAdjustment;
          this.logger.log(
            `Price override applied for "${result.productName}": ${originalBaseRental} → ${item.priceOverride} minor BDT`,
          );
        }

        if (manualDto?.plan.handoverMethod === 'CUSTOMER_PICKUP') result.shippingFee = 0;

        validatedItems.push(result);
      }

      const summary = computeCartSummary(validatedItems);

      if (manualDto && acceptedQuote) {
        const expectedLines = acceptedQuote.itemizedLines as unknown as ManualQuoteLine[];
        const changedLines = validatedItems.flatMap((item, index) => {
          const expected = expectedLines[index];
          if (
            !expected
            || expected.productId !== item.productId
            || expected.variantSizeId !== item.variantSizeId
            || expected.policyVersionId !== item.policyVersionId
            || expected.quotedItemTotal !== quotedItemTotals[index]
            || expected.finalItemTotal !== item.itemTotal
            || expected.depositAmount !== item.depositAmount
          ) {
            return [{
              lineId: `${index}:${item.variantSizeId}`,
              productId: item.productId,
              variantSizeId: item.variantSizeId,
              previousTotal: expected?.finalItemTotal ?? null,
              currentTotal: item.itemTotal,
              previousPolicyVersionId: expected?.policyVersionId ?? null,
              currentPolicyVersionId: item.policyVersionId,
            }];
          }
          return [];
        });
        if (changedLines.length > 0) {
          throw new ConflictException({
            code: 'PRICING_CHANGED',
            message: 'Pricing changed after the quote was accepted; review the updated lines',
            affectedLines: changedLines,
          });
        }
      }

      // Step 3: Generate booking number (with row-level locking)
      const year = new Date().getFullYear();
      const bookingNumber = await this.generateBookingNumber(tx, tenantId, year);

      // Step 4: Apply discount if provided
      let discountAmount = 0;
      let discountType: string | null = null;
      let discountReason: string | null = null;

      if (dto.discount) {
        discountType = dto.discount.type;
        discountReason = dto.discount.reason;
        discountAmount = this.computeDiscountAmount(dto.discount, summary);
      }

      const grandTotalAfterDiscount = summary.grandTotal - discountAmount;
      if (storefrontQuote && storefrontQuote.grandTotal !== grandTotalAfterDiscount) {
        throw new ConflictException({
          code: 'CHECKOUT_TOTAL_CHANGED',
          message: 'The authoritative total changed; refresh checkout before placing the booking',
          previousTotal: storefrontQuote.grandTotal,
          currentTotal: grandTotalAfterDiscount,
        });
      }
      if (manualDto && acceptedQuote && (
        acceptedQuote.subtotal !== summary.subtotal
        || acceptedQuote.totalFees !== summary.totalFees
        || acceptedQuote.shippingFee !== summary.shippingFee
        || acceptedQuote.totalDeposit !== summary.totalDeposit
        || acceptedQuote.discountAmount !== discountAmount
        || acceptedQuote.grandTotal !== grandTotalAfterDiscount
      )) {
        throw new ConflictException({
          code: 'QUOTE_TOTAL_CHANGED',
          message: 'The authoritative booking total changed; refresh the quote before creating the booking',
          previousTotal: acceptedQuote.grandTotal,
          currentTotal: grandTotalAfterDiscount,
        });
      }

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
      const storefrontStartDate = manualDto
        ? manualDto.plan.startDate
        : dto.items.reduce((earliest, item) => item.startDate < earliest ? item.startDate : earliest, dto.items[0].startDate);
      const storefrontEndDate = manualDto
        ? manualDto.plan.endDate
        : dto.items.reduce((latest, item) => item.endDate > latest ? item.endDate : latest, dto.items[0].endDate);

      // Step 5: Create booking
      const newBooking = await tx.booking.create({
        data: {
          tenantId,
          creationKey,
          creationRequestHash,
          bookingNumber,
          customerId: customer.id,
          quoteId: manualDto?.quoteId ?? null,
          storefrontQuoteId,
          channel: manualDto ? BookingChannel.OWNER_MANUAL : BookingChannel.STOREFRONT,
          rentalStartDate: new Date(storefrontStartDate),
          rentalEndDate: new Date(storefrontEndDate),
          sourceLocationId: manualDto?.plan.sourceLocationId ?? null,
          handoverMethod: manualDto?.plan.handoverMethod ?? 'DELIVERY',
          returnMethod: manualDto?.plan.returnMethod ?? 'BUSINESS_PICKUP',
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

        // Pricing components are already resolved and snapshotted by the pricing engine.
        const effectiveTryOnFee = item.tryOnFee;
        const adjustedItemTotal = item.itemTotal;

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
            quotedItemTotal: quotedItemTotals[itemIndex],
            priceOverrideAmount: cartItem.priceOverride ?? null,
            priceOverrideReason: cartItem.priceOverrideReason?.trim() ?? null,
            lateFee: 0,
            lateDays: 0,
          },
        });

        await this.fulfillment.createRequirements(tx, {
          tenantId,
          bookingId: newBooking.id,
          bookingItemId: bookingItem.id,
          startDate: cartItem.startDate,
          endDate: cartItem.endDate,
          reservationStatus: dto.autoConfirm ? 'CONFIRMED' : 'PENDING',
          expiresAt: pendingReservationExpiresAt,
          proposals: fulfillmentProposals[itemIndex],
          itemRevenue: adjustedItemTotal,
          sourceLocationId: manualDto?.plan.sourceLocationId,
        });
      }

      const submittedTransactionId = dto.paymentMethod === 'bkash'
        ? dto.bkashTransactionId?.trim()
        : dto.paymentMethod === 'nagad'
          ? dto.nagadTransactionId?.trim()
          : null;
      if (!manualDto && submittedTransactionId) {
        const duplicateTransaction = await tx.payment.findFirst({
          where: { tenantId, transactionId: submittedTransactionId },
          select: { id: true },
        });
        if (duplicateTransaction) {
          throw new ConflictException({
            code: 'PAYMENT_TRANSACTION_DUPLICATE',
            message: 'This mobile-payment transaction ID has already been submitted',
          });
        }
        await tx.payment.create({
          data: {
            tenantId,
            bookingId: newBooking.id,
            idempotencyKey: `claim:${createHash('sha256').update(creationKey ?? newBooking.id).digest('hex')}`,
            requestHash: this.canonicalHash({
              method: dto.paymentMethod,
              transactionId: submittedTransactionId,
              amount: grandTotalAfterDiscount,
            }),
            amount: grandTotalAfterDiscount,
            rentalAmount: grandTotalAfterDiscount - summary.totalDeposit,
            depositAmount: summary.totalDeposit,
            method: dto.paymentMethod as PaymentMethod,
            status: 'pending',
            transactionId: submittedTransactionId,
            notes: 'Customer-submitted payment claim awaiting verification',
          },
        });
      }

      // Step 7: Record initial payment if provided
      if (dto.initialPayment) {
        if (dto.initialPayment.amount > grandTotalAfterDiscount) {
          throw new BadRequestException('Initial payment cannot exceed the final booking total');
        }
        const paymentAmount = dto.initialPayment.amount;
        const paymentDepositAmount = dto.initialPayment.depositAmount ?? 0;
        if (paymentDepositAmount > paymentAmount) {
          throw new BadRequestException('Initial deposit allocation cannot exceed the payment amount');
        }
        if (paymentDepositAmount > summary.totalDeposit) {
          throw new BadRequestException('Initial deposit allocation cannot exceed the booking deposits');
        }
        const paymentRentalAmount = paymentAmount - paymentDepositAmount;
        if (paymentRentalAmount > grandTotalAfterDiscount - summary.totalDeposit) {
          throw new BadRequestException('Initial rental allocation cannot exceed the non-deposit balance');
        }
        if (dto.initialPayment.transactionId) {
          const duplicateTransaction = await tx.payment.findFirst({
            where: { tenantId, transactionId: dto.initialPayment.transactionId },
            select: { id: true },
          });
          if (duplicateTransaction) {
            throw new ConflictException({
              code: 'PAYMENT_TRANSACTION_DUPLICATE',
              message: `Transaction ID "${dto.initialPayment.transactionId}" is already recorded`,
            });
          }
        }
        await tx.payment.create({
          data: {
            tenantId,
            bookingId: newBooking.id,
            idempotencyKey: creationKey ? `initial:${createHash('sha256').update(creationKey).digest('hex')}` : null,
            requestHash: this.canonicalHash(dto.initialPayment),
            amount: paymentAmount,
            rentalAmount: paymentRentalAmount,
            depositAmount: paymentDepositAmount,
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
        if (summary.totalDeposit > 0 && paymentDepositAmount > 0) {
          await tx.bookingItem.updateMany({
            where: { tenantId, bookingId: newBooking.id, depositAmount: { gt: 0 } },
            data: {
              depositStatus: paymentDepositAmount >= summary.totalDeposit ? 'held' : 'collected',
            },
          });
        }
      }

      return tx.booking.findUnique({
        where: { id: newBooking.id },
        include: BOOKING_CREATED_INCLUDE,
      });
      });
    } catch (error) {
      if (
        creationKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.booking.findFirst({
          where: { tenantId, creationKey },
          include: BOOKING_CREATED_INCLUDE,
        });
        if (existing) {
          this.assertMatchingBookingRequest(existing, creationRequestHash);
          return this.toBookingCreatedResponse(existing);
        }
      }
      throw error;
    }

    if (!booking) throw new UnprocessableEntityException('Failed to create booking');

    // Step 8: Emit events (ADR-05)
    this.eventEmitter.emit('booking.created', {
      tenantId,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      trackingToken: booking.publicTrackingToken,
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
      `${dto.initialPayment ? ` [initial payment: ${dto.initialPayment.amount} minor BDT]` : ''}`,
    );

    return this.toBookingCreatedResponse(booking);
  }

  private toBookingCreatedResponse(booking: BookingCreatedRecord) {
    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      trackingToken: booking.publicTrackingToken,
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
      customer: {
        id: booking.customer.id,
        fullName: booking.customer.fullName,
        primaryPhone: booking.customer.identities[0]?.value ?? null,
      },
      items: booking.items,
      payments: booking.payments,
    };
  }

  private assertMatchingBookingRequest(
    booking: BookingCreatedRecord,
    creationRequestHash: string | null,
  ) {
    if (!creationRequestHash || booking.creationRequestHash !== creationRequestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This booking creation key was already used for another request',
      });
    }
  }

  private bookingRequestHash(dto: CreateBookingDto): string {
    return this.canonicalHash(dto);
  }

  private computeDiscountAmount(
    discount: CreateManualBookingQuoteDto['discount'],
    summary: CartSummary,
  ) {
    if (!discount) return 0;
    const discountableAmount = summary.subtotal + summary.totalFees + summary.shippingFee;
    if (discount.type === 'percentage') {
      if (!Number.isInteger(discount.value) || discount.value > 100) {
        throw new BadRequestException('Percentage discount must be a whole number from 0 to 100');
      }
      return Math.ceil(discountableAmount * (discount.value / 100));
    }
    if (!Number.isInteger(discount.value) || discount.value > discountableAmount) {
      throw new BadRequestException('Flat discount cannot exceed the non-deposit rental charges');
    }
    return discount.value;
  }

  private canonicalHash(value: unknown): string {
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalize(child)]),
        );
      }
      return value;
    };
    return createHash('sha256')
      .update(JSON.stringify(canonicalize(value)))
      .digest('hex');
  }

  private parseLateFeePolicy(value: Prisma.JsonValue | undefined): LateFeePolicy | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const policy = value as Prisma.JsonObject;
    if (
      typeof policy.enabled !== 'boolean' ||
      typeof policy.graceHours !== 'number' ||
      !['PER_DAY', 'FLAT', 'PERCENT_BASE'].includes(String(policy.mode))
    ) {
      return null;
    }
    return {
      enabled: policy.enabled,
      graceHours: policy.graceHours,
      mode: policy.mode as LateFeePolicy['mode'],
      amountMinor: typeof policy.amountMinor === 'number' ? policy.amountMinor : undefined,
      percent: typeof policy.percent === 'number' ? policy.percent : undefined,
      totalCapMinor: typeof policy.totalCapMinor === 'number' ? policy.totalCapMinor : undefined,
    };
  }

  // =========================================================================
  // BOOKING QUERIES
  // =========================================================================

  async getBookingList(tenantId: string, query: BookingQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, BOOKING_LIST_MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      tenantId,
      deletedAt: null,
    };
    const combinedFilters: Prisma.BookingWhereInput[] = [];

    if (query.status) where.status = query.status;
    if (query.queue) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const needsSerializedAssignment: Prisma.BookingWhereInput = {
        items: {
          some: {
            fulfillmentRequirements: {
              some: {
                trackingModeSnapshot: 'SERIALIZED' as const,
                status: { in: [
                  FulfillmentRequirementStatus.PLANNED,
                  FulfillmentRequirementStatus.RESERVED,
                  FulfillmentRequirementStatus.PARTIALLY_ASSIGNED,
                ] },
              },
            },
          },
        },
      };
      const hasShortage: Prisma.BookingWhereInput = {
        items: { some: { fulfillmentRequirements: { some: { status: 'PLANNED' } } } },
      };
      const notReady: Prisma.BookingWhereInput = { OR: [needsSerializedAssignment, hasShortage] };
      const hasUnpreparedRequirement: Prisma.BookingWhereInput = {
        items: {
          some: {
            fulfillmentRequirements: {
              some: {
                status: { notIn: ['CANCELLED', 'SUPERSEDED'] },
                preparationStatus: { not: 'READY' },
              },
            },
          },
        },
      };
      if (query.queue === 'REQUEST') where.status = 'pending';
      if (query.queue === 'ASSIGNMENT') {
        where.status = 'confirmed';
        combinedFilters.push(notReady);
      }
      if (query.queue === 'PREPARATION') {
        where.status = 'confirmed';
        combinedFilters.push({ NOT: notReady }, hasUnpreparedRequirement);
      }
      if (query.queue === 'HANDOFF') {
        where.status = 'confirmed';
        combinedFilters.push({ NOT: notReady }, { NOT: hasUnpreparedRequirement });
      }
      if (query.queue === 'ACTIVE') where.status = 'delivered';
      if (query.queue === 'RETURN_DUE') {
        where.status = { in: ['delivered', 'overdue'] };
        combinedFilters.push({ items: { some: { endDate: { lte: tomorrow } } } });
      }
      if (query.queue === 'RETURN_INTAKE') where.status = { in: ['delivered', 'overdue'] };
      if (query.queue === 'INSPECTION') where.status = { in: ['returned', 'inspected'] };
      if (query.queue === 'EXCEPTION') {
        combinedFilters.push({
          OR: [
            { status: 'overdue' },
            hasShortage,
            { items: { some: { stockUnitIssues: { some: { status: { in: ['OPEN', 'IN_SERVICE'] } } } } } },
          ],
        });
      }
      if (query.queue === 'CLOSED') where.status = { in: ['completed', 'cancelled'] };
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
      if (query.dateTo) {
        const exclusiveEnd = new Date(query.dateTo);
        exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
        where.createdAt.lt = exclusiveEnd;
      }
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { bookingNumber: { contains: search, mode: 'insensitive' } },
        { deliveryName: { contains: search, mode: 'insensitive' } },
        { deliveryPhone: { contains: search } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
        { customer: { identities: { some: { value: { contains: search, mode: 'insensitive' } } } } },
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
      combinedFilters.push({ items: { some: itemFilter } });
    }
    if (combinedFilters.length) where.AND = combinedFilters;

    const order = query.order ?? 'desc';
    const orderBy: Prisma.BookingOrderByWithRelationInput = query.sort === 'grandTotal'
      ? { grandTotal: order }
      : { createdAt: order };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [orderBy, { id: 'asc' }],
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              identities: {
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                select: { kind: true, value: true, isPrimary: true },
              },
            },
          },
          sourceLocation: { select: { id: true, code: true, name: true } },
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
              quantity: true,
              depositAmount: true,
              depositStatus: true,
              depositSettlement: { select: { id: true } },
              stockUnitInspections: {
                where: { inspectionType: 'RETURN', status: 'COMPLETED' },
                select: { id: true },
              },
              stockUnitIssues: {
                where: { status: { in: ['OPEN', 'IN_SERVICE'] } },
                select: { id: true },
              },
              fulfillmentRequirements: {
                where: { status: { notIn: ['CANCELLED', 'SUPERSEDED'] } },
                select: {
                  status: true,
                  sourceLocationId: true,
                  trackingModeSnapshot: true,
                  quantity: true,
                  assignedQuantity: true,
                  handedOutQuantity: true,
                  returnedQuantity: true,
                  lostQuantity: true,
                  preparationStatus: true,
                },
              },
            },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings.map((booking) => {
        const requirements = booking.items.flatMap((item) => item.fulfillmentRequirements);
        const serialized = requirements.filter((item) => item.trackingModeSnapshot === 'SERIALIZED');
        const serializedRequired = serialized.reduce((sum, item) => sum + item.quantity, 0);
        const serializedAssigned = serialized.reduce((sum, item) => sum + item.assignedQuantity, 0);
        const inventoryShortages = requirements.filter((item) => item.status === 'PLANNED').length;
        const handedOutQuantity = requirements.reduce((sum, item) => sum + item.handedOutQuantity, 0);
        const returnedQuantity = requirements.reduce((sum, item) => sum + item.returnedQuantity, 0);
        const lostQuantity = requirements.reduce((sum, item) => sum + item.lostQuantity, 0);
        const unresolvedReturnQuantity = Math.max(0, handedOutQuantity - returnedQuantity - lostQuantity);
        const completedReturnInspections = booking.items.reduce((sum, item) => sum + item.stockUnitInspections.length, 0);
        const serializedReturned = serialized.reduce((sum, item) => sum + item.returnedQuantity, 0);
        const inspectionOutstanding = Math.max(0, serializedReturned - completedReturnInspections);
        const unresolvedIssueCount = booking.items.reduce((sum, item) => sum + item.stockUnitIssues.length, 0);
        const unsettledDepositCount = booking.items.filter((item) => item.depositAmount > 0 && !item.depositSettlement).length;
        const balanceDue = Math.max(0, booking.grandTotal - booking.totalPaid);
        const rentalStartDate = booking.items.reduce<Date | null>(
          (minimum, item) => !minimum || item.startDate < minimum ? item.startDate : minimum,
          null,
        );
        const rentalEndDate = booking.items.reduce<Date | null>(
          (maximum, item) => !maximum || item.endDate > maximum ? item.endDate : maximum,
          null,
        );
        const needsAssignment = booking.status === 'confirmed' && serializedAssigned < serializedRequired;
        const unpreparedRequirementCount = requirements.filter((item) => item.preparationStatus !== 'READY').length;
        const preparationReady = inventoryShortages === 0
          && serializedAssigned >= serializedRequired
          && unpreparedRequirementCount === 0;
        const nextAction = booking.status === 'pending'
          ? 'REVIEW'
          : booking.status === 'confirmed'
            ? needsAssignment || inventoryShortages > 0
              ? 'ASSIGN_ITEMS'
              : !preparationReady
                ? 'PREPARE'
                : handedOutQuantity < requirements.reduce((sum, item) => sum + item.quantity, 0)
                  ? 'HAND_OUT'
                  : 'START_RENTAL'
            : booking.status === 'delivered' || booking.status === 'overdue'
              ? 'RECEIVE_RETURN'
              : booking.status === 'returned'
                ? inspectionOutstanding > 0 ? 'INSPECT' : 'REVIEW_RETURN'
                : booking.status === 'inspected'
                  ? unsettledDepositCount > 0 ? 'SETTLE_DEPOSIT' : balanceDue > 0 ? 'COLLECT_BALANCE' : unresolvedIssueCount > 0 ? 'RESOLVE_RETURN_WORK' : 'COMPLETE'
                  : 'NONE';
        const blockers = [
          ...(inventoryShortages > 0 ? [`${inventoryShortages} inventory requirement${inventoryShortages === 1 ? '' : 's'} have no capacity`] : []),
          ...(needsAssignment ? [`${serializedRequired - serializedAssigned} serialized assignment${serializedRequired - serializedAssigned === 1 ? '' : 's'} missing`] : []),
          ...(unpreparedRequirementCount > 0 ? [`${unpreparedRequirementCount} requirement${unpreparedRequirementCount === 1 ? '' : 's'} not prepared`] : []),
          ...(unresolvedReturnQuantity > 0 ? [`${unresolvedReturnQuantity} handed-out piece${unresolvedReturnQuantity === 1 ? '' : 's'} not returned or lost`] : []),
          ...(inspectionOutstanding > 0 ? [`${inspectionOutstanding} returned physical item${inspectionOutstanding === 1 ? '' : 's'} awaiting inspection`] : []),
          ...(unsettledDepositCount > 0 ? [`${unsettledDepositCount} deposit settlement${unsettledDepositCount === 1 ? '' : 's'} pending`] : []),
          ...(balanceDue > 0 ? [`Booking balance due: ${balanceDue} minor BDT`] : []),
          ...(unresolvedIssueCount > 0 ? [`${unresolvedIssueCount} return issue${unresolvedIssueCount === 1 ? '' : 's'} unresolved`] : []),
        ];
        return {
          ...booking,
          customer: {
            id: booking.customer.id,
            fullName: booking.customer.fullName,
            primaryPhone: booking.customer.identities.find((identity) => identity.kind === 'phone' && identity.isPrimary)?.value
              ?? booking.customer.identities.find((identity) => identity.kind === 'phone')?.value
              ?? null,
            primaryEmail: booking.customer.identities.find((identity) => identity.kind === 'email' && identity.isPrimary)?.value
              ?? booking.customer.identities.find((identity) => identity.kind === 'email')?.value
              ?? null,
          },
          operations: {
            rentalStartDate,
            rentalEndDate,
            totalQuantity: booking.items.reduce((sum, item) => sum + item.quantity, 0),
            requirementCount: requirements.length,
            inventoryShortages,
            serializedRequired,
            serializedAssigned,
            needsAssignment,
            preparationReady,
            handedOutQuantity,
            returnedQuantity,
            lostQuantity,
            unresolvedReturnQuantity,
            inspectionOutstanding,
            unsettledDepositCount,
            unresolvedIssueCount,
            balanceDue,
            sourceLocation: booking.sourceLocation,
            handoverMethod: booking.handoverMethod,
            returnMethod: booking.returnMethod,
            blockers,
            nextAction,
          },
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingCalendar(tenantId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      throw new BadRequestException({ code: 'INVALID_CALENDAR_RANGE', message: 'Calendar end date must be on or after its start date' });
    }
    const rangeDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (rangeDays > 124) {
      throw new BadRequestException({ code: 'CALENDAR_RANGE_TOO_LARGE', message: 'Calendar ranges cannot exceed 124 days' });
    }
    const rows = await this.prisma.booking.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'cancelled' },
        items: { some: { endDate: { gte: start }, startDate: { lte: end } } },
      },
      orderBy: [{ rentalStartDate: 'asc' }, { id: 'asc' }],
      take: 5_001,
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            identities: {
              where: { kind: 'phone' },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              take: 1,
              select: { value: true },
            },
          },
        },
        items: {
          where: { endDate: { gte: start }, startDate: { lte: end } },
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
          select: { id: true, productName: true, startDate: true, endDate: true },
        },
      },
    });
    if (rows.length > 5_000) {
      throw new ConflictException({
        code: 'CALENDAR_RANGE_TOO_DENSE',
        message: 'This calendar range contains more than 5,000 bookings; select a narrower range',
      });
    }
    return rows.map((row) => ({
      ...row,
      customer: {
        id: row.customer.id,
        fullName: row.customer.fullName,
        primaryPhone: row.customer.identities[0]?.value ?? null,
      },
    }));
  }

  async getBookingById(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      include: {
        customer: {
          include: {
            identities: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
            tagAssignments: { include: { tag: true } },
          },
        },
        sourceLocation: {
          select: { id: true, code: true, name: true, timezone: true },
        },
        items: {
          include: {
            damageReport: true,
            depositSettlement: true,
            stockUnitIssues: {
              select: {
                id: true,
                issueType: true,
                severity: true,
                status: true,
                responsibility: true,
                description: true,
                estimatedCost: true,
                customerCharge: true,
                assignmentId: true,
                inspectionId: true,
                stockUnit: { select: { id: true, assetCode: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
            variantSize: { include: { sizeInstance: true } },
            fulfillmentRequirements: {
              include: {
                compositionRule: true,
                reservation: {
                  include: {
                    assignments: {
                      where: { releasedAt: null },
                      include: { stockUnit: true },
                    },
                  },
                },
                events: { orderBy: { createdAt: 'desc' } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 201,
        },
        fulfillmentExtensions: {
          orderBy: { createdAt: 'desc' },
          take: 201,
          include: { actor: { select: { id: true, fullName: true } } },
        },
        shipments: {
          where: { direction: 'OUTBOUND' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { events: { orderBy: { occurredAt: 'asc' } } },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    const operationalTimeline = await this.getOperationalTimeline(tenantId, booking);
    const primaryPhone = booking.customer.identities.find((identity) => identity.kind === 'phone' && identity.isPrimary)
      ?? booking.customer.identities.find((identity) => identity.kind === 'phone');
    const primaryEmail = booking.customer.identities.find((identity) => identity.kind === 'email' && identity.isPrimary)
      ?? booking.customer.identities.find((identity) => identity.kind === 'email');
    const shipment = booking.shipments[0] ?? null;
    return {
      ...booking,
      shipments: undefined,
      trackingNumber: shipment?.trackingNumber ?? null,
      courierProvider: shipment?.provider ?? null,
      courierConsignmentId: shipment?.providerReference ?? null,
      courierStatus: shipment?.status ?? null,
      courierStatusHistory: shipment?.events.map((event) => ({
        status: event.status,
        label: event.label,
        timestamp: event.occurredAt,
        source: event.source,
      })) ?? [],
      pickupRequestedAt: shipment?.pickupRequestedAt ?? null,
      scheduledPickupAt: shipment?.scheduledPickupAt ?? null,
      courierErrorReason: shipment?.failedReason ?? null,
      customer: {
        ...booking.customer,
        primaryPhone: primaryPhone?.value ?? null,
        primaryEmail: primaryEmail?.value ?? null,
        tags: booking.customer.tagAssignments.map((assignment) => assignment.tag),
        tagAssignments: undefined,
      },
      operationalTimeline,
    };
  }

  private async getOperationalTimeline(
    tenantId: string,
    booking: {
      id: string;
      status: BookingStatus;
      createdAt: Date;
      confirmedAt: Date | null;
      deliveredAt: Date | null;
      returnedAt: Date | null;
      completedAt: Date | null;
      cancelledAt: Date | null;
      cancellationReason: string | null;
      updatedAt: Date;
    },
  ) {
    const sourceLimit = 201;
    const [events, versions, substitutions, extensions, payments, settlements, damageReports, shipmentEvents] =
      await Promise.all([
        this.prisma.fulfillmentRequirementEvent.findMany({
          where: { tenantId, requirement: { bookingId: booking.id } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: {
            actor: { select: { id: true, fullName: true } },
            requirement: { select: { productNameSnapshot: true } },
          },
        }),
        this.prisma.fulfillmentRequirementVersion.findMany({
          where: { tenantId, requirement: { bookingId: booking.id } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: {
            actor: { select: { id: true, fullName: true } },
            requirement: { select: { productNameSnapshot: true } },
          },
        }),
        this.prisma.fulfillmentSubstitution.findMany({
          where: { tenantId, requirement: { bookingId: booking.id } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: {
            actor: { select: { id: true, fullName: true } },
            requirement: { select: { productNameSnapshot: true } },
          },
        }),
        this.prisma.fulfillmentExtension.findMany({
          where: { tenantId, bookingId: booking.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: { actor: { select: { id: true, fullName: true } } },
        }),
        this.prisma.payment.findMany({
          where: { tenantId, bookingId: booking.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: { recorder: { select: { id: true, fullName: true } } },
        }),
        this.prisma.depositSettlement.findMany({
          where: { tenantId, bookingId: booking.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: { actor: { select: { id: true, fullName: true } } },
        }),
        this.prisma.damageReport.findMany({
          where: { tenantId, bookingItem: { bookingId: booking.id } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
          include: { reporter: { select: { id: true, fullName: true } } },
        }),
        this.prisma.shipmentEvent.findMany({
          where: { tenantId, shipment: { bookingId: booking.id } },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: sourceLimit,
        }),
      ]);

    const timeline: BookingOperationalTimelineEvent[] = [
      this.timelineEvent('booking-created', 'BOOKING', 'BOOKING_CREATED', 'Booking created', booking.createdAt),
    ];
    const bookingStages: Array<[Date | null, string, string, string | null]> = [
      [booking.confirmedAt, 'BOOKING_CONFIRMED', 'Booking confirmed', null],
      [booking.deliveredAt, 'BOOKING_DELIVERED', 'Rental handed over', null],
      [booking.returnedAt, 'BOOKING_RETURNED', 'Rental returned', null],
      [booking.completedAt, 'BOOKING_COMPLETED', 'Booking completed', null],
      [booking.cancelledAt, 'BOOKING_CANCELLED', 'Booking cancelled', booking.cancellationReason],
    ];
    for (const [at, code, label, reason] of bookingStages) {
      if (at) timeline.push(this.timelineEvent(`booking-${code}`, 'BOOKING', code, label, at, null, reason));
    }
    if (booking.status === BookingStatus.overdue) {
      timeline.push(this.timelineEvent('booking-overdue', 'BOOKING', 'BOOKING_OVERDUE', 'Rental overdue', booking.updatedAt));
    }

    for (const event of shipmentEvents) {
      timeline.push(this.timelineEvent(
        `shipment-event-${event.id}`,
        'COURIER',
        `SHIPMENT_${event.status.toUpperCase()}`,
        event.label,
        event.occurredAt,
        null,
        null,
        null,
        { shipmentId: event.shipmentId, source: event.source },
      ));
    }

    for (const event of events) {
      timeline.push(this.timelineEvent(
        `fulfillment-event-${event.id}`,
        'FULFILLMENT',
        event.eventType,
        `${event.requirement.productNameSnapshot}: ${event.eventType.toLowerCase().replace(/_/g, ' ')}`,
        event.createdAt,
        event.actor,
        event.reason,
        null,
        { quantity: event.quantity, fromStatus: event.fromStatus, toStatus: event.toStatus },
      ));
    }
    for (const version of versions) {
      timeline.push(this.timelineEvent(
        `fulfillment-version-${version.id}`,
        'FULFILLMENT',
        `REQUIREMENT_${version.action}`,
        `${version.requirement.productNameSnapshot}: plan ${version.action.toLowerCase().replace(/_/g, ' ')}`,
        version.createdAt,
        version.actor,
        version.reason,
        version.priceImpact,
        { version: version.version },
      ));
    }
    for (const substitution of substitutions) {
      timeline.push(this.timelineEvent(
        `substitution-${substitution.id}`,
        'FULFILLMENT',
        'ITEM_SUBSTITUTED',
        `${substitution.requirement.productNameSnapshot}: item substituted`,
        substitution.createdAt,
        substitution.actor,
        substitution.reason,
        substitution.priceImpact,
        { approvalStatus: substitution.approvalStatus, approvalEvidence: substitution.approvalEvidence },
      ));
    }
    for (const extension of extensions) {
      timeline.push(this.timelineEvent(
        `extension-${extension.id}`,
        'COMMERCIAL',
        'RENTAL_EXTENDED',
        'Rental dates extended',
        extension.createdAt,
        extension.actor,
        extension.reason,
        extension.extensionCharge,
        {
          previousEndDate: extension.previousEndDate,
          rentalEndDate: extension.rentalEndDate,
          approvalEvidence: extension.approvalEvidence,
        },
      ));
    }
    for (const payment of payments) {
      timeline.push(this.timelineEvent(
        `payment-${payment.id}`,
        'COMMERCIAL',
        `PAYMENT_${payment.status.toUpperCase()}`,
        `${payment.status === 'verified' ? 'Payment received' : `Payment ${payment.status}`}`,
        payment.verifiedAt ?? payment.createdAt,
        payment.recorder,
        payment.notes,
        payment.amount,
        { method: payment.method, transactionId: payment.transactionId },
      ));
    }
    for (const settlement of settlements) {
      timeline.push(this.timelineEvent(
        `deposit-${settlement.id}`,
        'COMMERCIAL',
        'DEPOSIT_SETTLED',
        'Security deposit settled',
        settlement.createdAt,
        settlement.actor,
        settlement.reason,
        settlement.additionalCharge - settlement.refundAmount,
        {
          refundAmount: settlement.refundAmount,
          deductionAmount: settlement.deductionAmount,
          forfeitedAmount: settlement.forfeitedAmount,
        },
      ));
    }
    for (const report of damageReports) {
      timeline.push(this.timelineEvent(
        `damage-${report.id}`,
        'RETURN',
        'DAMAGE_REPORTED',
        `Damage reported: ${report.damageLevel.toLowerCase()}`,
        report.createdAt,
        report.reporter,
        report.description,
        report.additionalCharge,
        { deductionAmount: report.deductionAmount, estimatedRepairCost: report.estimatedRepairCost },
      ));
    }

    timeline.sort((left, right) => {
      const byDate = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
      return byDate || right.id.localeCompare(left.id);
    });
    const limit = 200;
    return {
      events: timeline.slice(0, limit),
      truncated: timeline.length > limit || [events, versions, substitutions, extensions, payments, settlements, damageReports, shipmentEvents]
        .some((source) => source.length === sourceLimit),
      limit,
    };
  }

  private timelineEvent(
    id: string,
    category: BookingOperationalTimelineEvent['category'],
    code: string,
    label: string,
    occurredAt: Date | string,
    actor: BookingOperationalTimelineEvent['actor'] = null,
    reason: string | null = null,
    amountMinor: number | null = null,
    metadata?: Record<string, unknown>,
  ): BookingOperationalTimelineEvent {
    return { id, category, code, label, occurredAt, actor, reason, amountMinor, ...(metadata ? { metadata } : {}) };
  }

  async getBookingByTrackingToken(tenantId: string, trackingToken: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { publicTrackingToken: trackingToken, tenantId },
      select: {
        bookingNumber: true,
        status: true,
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
        shipments: {
          where: { direction: 'OUTBOUND' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            trackingNumber: true,
            provider: true,
            status: true,
            events: { orderBy: { occurredAt: 'asc' }, select: { status: true, label: true, occurredAt: true } },
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

    const shipment = booking.shipments[0] ?? null;
    for (const event of shipment?.events ?? []) {
      timeline.push({ status: event.status, label: event.label, at: event.occurredAt, type: 'courier' });
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
      totalDays: Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      daysRemaining: Math.max(0, Math.ceil((latestEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      isActive: booking.status === 'delivered' && now >= earliestStart && now <= latestEnd,
      isOverdue: booking.status === 'delivered' && now > latestEnd,
    } : null;

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      trackingNumber: shipment?.trackingNumber ?? null,
      courierProvider: shipment?.provider ?? null,
      courierStatus: shipment?.status ?? null,
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

    const [pendingCount, overdueCount, needsAssignmentCount, todayHandoffs, todayReturns, todayDeliveries, totalActive, recentBookings, revenueAgg, topProductsRaw, recentRevenueBookings] =
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
            deletedAt: null,
            items: {
              some: {
                fulfillmentRequirements: {
                  some: {
                    trackingModeSnapshot: 'SERIALIZED',
                    status: { in: ['PLANNED', 'RESERVED', 'PARTIALLY_ASSIGNED'] },
                  },
                },
              },
            },
          },
        }),
        this.prisma.booking.count({
          where: {
            tenantId,
            status: 'confirmed',
            deletedAt: null,
            items: { some: { startDate: { gte: today, lt: tomorrow } } },
          },
        }),
        this.prisma.booking.count({
          where: {
            tenantId,
            status: { in: ['delivered', 'overdue'] },
            deletedAt: null,
            items: { some: { endDate: { gte: today, lt: tomorrow } } },
          },
        }),
        this.prisma.booking.count({
          where: {
            tenantId,
            status: 'confirmed',
            shipments: { some: { direction: 'OUTBOUND', status: { in: ['in_transit', 'out_for_delivery', 'at_destination'] } } },
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

    const [queueCountRow] = await this.prisma.$queryRaw<Array<Record<string, bigint>>>(Prisma.sql`
      SELECT
        COUNT(*) AS "ALL",
        COUNT(*) FILTER (WHERE b.status = 'pending') AS "REQUEST",
        COUNT(*) FILTER (WHERE b.status = 'confirmed' AND (
          EXISTS (SELECT 1 FROM fulfillment_requirements fr WHERE fr.booking_id = b.id AND fr.status = 'PLANNED')
          OR EXISTS (SELECT 1 FROM fulfillment_requirements fr WHERE fr.booking_id = b.id AND fr.tracking_mode_snapshot = 'SERIALIZED' AND fr.assigned_quantity < fr.quantity AND fr.status NOT IN ('CANCELLED', 'SUPERSEDED'))
        )) AS "ASSIGNMENT",
        COUNT(*) FILTER (WHERE b.status = 'confirmed' AND NOT EXISTS (
          SELECT 1 FROM fulfillment_requirements fr WHERE fr.booking_id = b.id AND (
            fr.status = 'PLANNED' OR (fr.tracking_mode_snapshot = 'SERIALIZED' AND fr.assigned_quantity < fr.quantity AND fr.status NOT IN ('CANCELLED', 'SUPERSEDED'))
          )
        ) AND EXISTS (
          SELECT 1 FROM fulfillment_requirements fr
          WHERE fr.booking_id = b.id AND fr.status NOT IN ('CANCELLED', 'SUPERSEDED') AND fr.preparation_status <> 'READY'
        )) AS "PREPARATION",
        COUNT(*) FILTER (WHERE b.status = 'confirmed' AND NOT EXISTS (
          SELECT 1 FROM fulfillment_requirements fr WHERE fr.booking_id = b.id AND (
            fr.status = 'PLANNED' OR (fr.tracking_mode_snapshot = 'SERIALIZED' AND fr.assigned_quantity < fr.quantity AND fr.status NOT IN ('CANCELLED', 'SUPERSEDED'))
          )
        ) AND NOT EXISTS (
          SELECT 1 FROM fulfillment_requirements fr
          WHERE fr.booking_id = b.id AND fr.status NOT IN ('CANCELLED', 'SUPERSEDED') AND fr.preparation_status <> 'READY'
        )) AS "HANDOFF",
        COUNT(*) FILTER (WHERE b.status = 'delivered') AS "ACTIVE",
        COUNT(*) FILTER (WHERE b.status IN ('delivered', 'overdue') AND COALESCE(b.rental_end_date, (SELECT MAX(bi.end_date) FROM booking_items bi WHERE bi.booking_id = b.id)) <= ${tomorrow}) AS "RETURN_DUE",
        COUNT(*) FILTER (WHERE b.status IN ('delivered', 'overdue')) AS "RETURN_INTAKE",
        COUNT(*) FILTER (WHERE b.status IN ('returned', 'inspected')) AS "INSPECTION",
        COUNT(*) FILTER (WHERE b.status = 'overdue' OR EXISTS (SELECT 1 FROM fulfillment_requirements fr WHERE fr.booking_id = b.id AND fr.status = 'PLANNED') OR EXISTS (
          SELECT 1 FROM stock_unit_issues sui JOIN booking_items bi ON bi.id = sui.booking_item_id WHERE bi.booking_id = b.id AND sui.status IN ('OPEN', 'IN_SERVICE')
        )) AS "EXCEPTION",
        COUNT(*) FILTER (WHERE b.status IN ('completed', 'cancelled')) AS "CLOSED"
      FROM bookings b
      WHERE b.tenant_id = ${tenantId} AND b.deleted_at IS NULL
    `);
    const queueCounts = Object.fromEntries(
      Object.entries(queueCountRow ?? {}).map(([queue, count]) => [queue, Number(count)]),
    );

    return {
      pendingCount,
      overdueCount,
      needsAssignmentCount,
      todayHandoffs,
      todayReturns,
      todayDeliveries,
      totalActive,
      queueCounts,
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
  ) {
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

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM bookings
        WHERE tenant_id = ${tenantId} AND id = ${bookingId} AND deleted_at IS NULL
        FOR UPDATE
      `);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId, deletedAt: null },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      const allowed = VALID_TRANSITIONS[booking.status];
      if (!allowed.includes(newStatus)) {
        throw new UnprocessableEntityException(
          `Cannot transition from "${booking.status}" to "${newStatus}". ` +
            `Allowed: ${allowed.join(', ') || 'none'}`,
        );
      }
      await this.fulfillment.assertAndTransitionBooking(
        tx,
        tenantId,
        bookingId,
        newStatus,
      );
      await this.inventoryReservations.transitionForBooking(
        tx,
        tenantId,
        bookingId,
        newStatus,
      );
      const updated = await tx.booking.update({
        where: { id: bookingId, tenantId },
        data: updateData,
      });
      return { updated, previousStatus: booking.status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const updated = result.updated;

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
      `Booking ${updated.bookingNumber}: ${result.previousStatus} → ${newStatus}`,
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

      await this.fulfillment.assertAndTransitionBooking(
        tx,
        tenantId,
        bookingId,
        'cancelled',
        dto.reason,
      );
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
      include: {
        depositSettlement: { select: { id: true } },
        fulfillmentRequirements: {
          where: { status: { notIn: ['CANCELLED', 'SUPERSEDED'] } },
          select: { trackingModeSnapshot: true },
        },
      },
    });
    if (!item) throw new NotFoundException('Booking item not found');

    // Check booking is in inspected state (only report damage after returned/inspected)
    const booking = await this.findBookingOrFail(tenantId, bookingId);
    if (!['returned', 'inspected'].includes(booking.status)) {
      throw new UnprocessableEntityException(
        'Damage reports can only be created for returned or inspected bookings',
      );
    }
    if (item.depositSettlement) {
      throw new ConflictException({
        code: 'DEPOSIT_ALREADY_SETTLED',
        message: 'Damage evidence cannot be changed after the final deposit settlement',
      });
    }
    if (dto.deductionAmount > item.depositAmount) {
      throw new BadRequestException('Suggested deposit deduction cannot exceed the item deposit');
    }
    const requiresExactIssue = item.fulfillmentRequirements.some(
      (requirement) => requirement.trackingModeSnapshot === 'SERIALIZED',
    );
    if (requiresExactIssue && !dto.stockUnitIssueId) {
      throw new ConflictException({
        code: 'EXACT_ITEM_ISSUE_REQUIRED',
        message: 'Select the inspected physical-item issue that supports this damage report',
      });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM bookings
        WHERE tenant_id = ${tenantId} AND id = ${bookingId} AND deleted_at IS NULL
        FOR UPDATE
      `);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId, deletedAt: null },
        include: {
          items: {
            include: {
              product: {
                include: {
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

      let lateItemsUpdated = 0;
      let feeDelta = 0;
      for (const item of booking.items) {
        const expectedReturnDate = new Date(item.endDate);
        const lateDays = today > expectedReturnDate
          ? Math.floor((today.getTime() - expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const activeVersion = item.product?.pricingProfile?.policyVersions[0];
        const lateFee = this.pricingEngineService.computeLateFee(
          this.parseLateFeePolicy(activeVersion?.lateFeePolicy),
          item.baseRental,
          lateDays,
        );
        if (lateDays === item.lateDays && lateFee === item.lateFee) continue;
        const itemFeeDelta = lateFee - item.lateFee;
        if (item.itemTotal + itemFeeDelta < 0) {
          throw new ConflictException('Late-fee recalculation would make an item total negative');
        }
        await tx.bookingItem.update({
          where: { id: item.id },
          data: {
            lateDays,
            lateFee,
            itemTotal: { increment: itemFeeDelta },
          },
        });
        feeDelta += itemFeeDelta;
        lateItemsUpdated += 1;
      }
      if (feeDelta !== 0) {
        const nextGrandTotal = booking.grandTotal + feeDelta;
        if (nextGrandTotal < 0 || booking.totalFees + feeDelta < 0) {
          throw new ConflictException('Late-fee recalculation would make booking totals negative');
        }
        const paymentStatus = booking.totalPaid <= 0
          ? 'unpaid'
          : booking.totalPaid >= nextGrandTotal ? 'paid' : 'partial';
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            totalFees: { increment: feeDelta },
            grandTotal: nextGrandTotal,
            paymentStatus,
          },
        });
      }
      return { bookingId, lateItemsUpdated, feeDelta };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    sourceLocationId?: string,
  ): Promise<CartItemResult> {
    const errors: string[] = [];
    const quantity = item.quantity ?? 1;

    // Inventory identity is the tenant-owned variant-size, never a display label.
    const product = await tx.product.findFirst({
      where: { id: item.productId, tenantId, deletedAt: null },
      include: {
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
        policyVersionId: '',
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
    const activeSchema =
      product.sizeSchemaOverride ?? product.productType?.defaultSizeSchema ?? null;
    const validSizeIds = activeSchema?.instances.map((instance) => instance.id) ?? [];

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
          preferredStockUnitId: item.preferredStockUnitId,
          sourceLocationId,
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
      item,
      tx,
      sourceLocationId,
    );
    const preferredUnit = item.preferredStockUnitId
      ? await tx.stockUnit.findFirst({
          where: {
            id: item.preferredStockUnitId,
            tenantId,
            variantSizeId: item.variantSizeId,
            storefrontVisible: true,
            variantSize: {
              variant: {
                product: { id: item.productId, storefrontItemMode: 'SPECIFIC_ITEM_SELECTION' },
              },
            },
          },
          select: { rentalPriceAdjustment: true },
        })
      : null;
    const adjustedBaseRental = Math.max(
      0,
      unitPricing.baseRental + (preferredUnit?.rentalPriceAdjustment ?? 0),
    );
    const pricing: PricingSnapshot = {
      ...unitPricing,
      baseRental: adjustedBaseRental * quantity,
      extendedCost: unitPricing.extendedCost * quantity,
      depositAmount: unitPricing.depositAmount * quantity,
      cleaningFee: unitPricing.cleaningFee * quantity,
      backupSizeFee: unitPricing.backupSizeFee * quantity,
      tryOnFee: unitPricing.tryOnFee * quantity,
      itemTotal:
        (unitPricing.itemTotal - unitPricing.baseRental + adjustedBaseRental) * quantity,
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
    item: { startDate: string; endDate: string; backupSize?: string; tryOn?: boolean },
    db: PrismaService | Prisma.TransactionClient = this.prisma,
    sourceLocationId?: string,
  ): Promise<PricingSnapshot> {
    return this.pricingEngineService.computeBookingPricing(
      productId,
      item.startDate,
      item.endDate,
      {
        backupSize: item.backupSize,
        tryOn: item.tryOn,
        location: sourceLocationId,
        channel: sourceLocationId ? 'owner_manual' : 'storefront',
      },
      db,
    );
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
