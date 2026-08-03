import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CompositionPricingBehavior,
  CompositionSkuResolution,
  CompositionSubstitutionPolicy,
  FulfillmentApprovalStatus,
  FulfillmentEventType,
  FulfillmentRequirementStatus,
  FulfillmentSelectionSource,
  FulfillmentVersionAction,
  InventoryReservationStatus,
  InventoryTrackingMode,
  Prisma,
  ProductCompositionRole,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExtendFulfillmentRequirementDto,
  FulfillmentSelectionDto,
  RecordFulfillmentEventDto,
  SubstituteFulfillmentRequirementDto,
} from './dto/fulfillment.dto';
import { InventoryAvailabilityService } from './inventory-availability.service';
import { InventoryReservationService } from './inventory-reservation.service';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';

const MAX_COMPOSITION_DEPTH = 5;

type Transaction = Prisma.TransactionClient;
type CompositionRule = Prisma.ProductCompositionRuleGetPayload<{
  include: {
    componentProduct: { select: { id: true; name: true } };
    fixedVariantSize: {
      include: { sizeInstance: true; variant: { include: { mainColor: true; product: true } } };
    };
    alternatives: {
      include: {
        product: { select: { id: true; name: true } };
        variantSize: {
          include: { sizeInstance: true; variant: { include: { mainColor: true; product: true } } };
        };
      };
    };
  };
}>;

export interface RequirementProposal {
  requirementKey: string;
  parentRequirementKey?: string;
  compositionRuleId?: string;
  selectedAlternativeId?: string;
  role: ProductCompositionRole;
  selectionSource: FulfillmentSelectionSource;
  productId: string;
  variantSizeId: string;
  quantity: number;
  productName: string;
  variantName: string | null;
  sizeLabel: string;
  ruleSnapshot?: Prisma.InputJsonValue;
  customerSelectionSnapshot?: Prisma.InputJsonValue;
  priceAdjustment: number;
}

interface ExpandInput {
  tenantId: string;
  productId: string;
  variantSizeId: string;
  quantity: number;
  selections?: FulfillmentSelectionDto[];
}

interface CreateRequirementsInput {
  tenantId: string;
  bookingId: string;
  bookingItemId: string;
  startDate: string | Date;
  endDate: string | Date;
  reservationStatus: InventoryReservationStatus;
  expiresAt?: Date | null;
  proposals: RequirementProposal[];
  itemRevenue: number;
}

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: InventoryAvailabilityService,
    private readonly reservations: InventoryReservationService,
    private readonly lifecycle: StockUnitLifecycleService,
  ) {}

  async expandProposal(tx: Transaction, input: ExpandInput): Promise<RequirementProposal[]> {
    const mainSku = await this.getSku(tx, input.tenantId, input.productId, input.variantSizeId);
    const selections = new Map((input.selections ?? []).map((selection) => [selection.compositionRuleId, selection]));
    const proposals: RequirementProposal[] = [{
      requirementKey: 'MAIN',
      role: ProductCompositionRole.MAIN,
      selectionSource: FulfillmentSelectionSource.MAIN_PRODUCT,
      productId: input.productId,
      variantSizeId: input.variantSizeId,
      quantity: input.quantity,
      productName: mainSku.variant.product.name,
      variantName: mainSku.variant.variantName,
      sizeLabel: mainSku.sizeInstance.displayLabel,
      priceAdjustment: 0,
      ruleSnapshot: this.json({ source: 'main-product' }),
    }];

    await this.expandProductRules(
      tx,
      input.tenantId,
      input.productId,
      mainSku,
      input.quantity,
      'MAIN',
      selections,
      proposals,
      new Set([input.productId]),
      0,
    );

    const knownRuleIds = new Set(proposals.flatMap((proposal) => proposal.compositionRuleId ? [proposal.compositionRuleId] : []));
    const unknownSelections = [...selections.keys()].filter((ruleId) => !knownRuleIds.has(ruleId));
    if (unknownSelections.length) {
      throw new BadRequestException('One or more component selections do not belong to this product composition');
    }
    return proposals;
  }

  async lockProposalSkus(tx: Transaction, tenantId: string, proposals: RequirementProposal[]) {
    await this.reservations.lockVariantSizes(tx, tenantId, proposals.map((proposal) => proposal.variantSizeId));
  }

  async createRequirements(tx: Transaction, input: CreateRequirementsInput) {
    const createdByKey = new Map<string, string>();
    const componentRevenue = input.proposals.slice(1).reduce((sum, proposal) => sum + Math.max(0, proposal.priceAdjustment), 0);
    const mainRevenue = Math.max(0, input.itemRevenue - componentRevenue);

    for (const proposal of input.proposals) {
      const availability = await this.availability.check({
        tenantId: input.tenantId,
        productId: proposal.productId,
        variantSizeId: proposal.variantSizeId,
        startDate: input.startDate,
        endDate: input.endDate,
        quantity: proposal.quantity,
        enforcePublished: false,
      }, tx);
      if (!availability.available || !availability.sourceLocationId || !availability.availabilityPolicy) {
        throw new ConflictException(
          `${proposal.productName} is unavailable: ${availability.reason ?? 'no fulfillment source can satisfy this requirement'}`,
        );
      }
      const requirement = await tx.fulfillmentRequirement.create({
        data: {
          tenantId: input.tenantId,
          bookingId: input.bookingId,
          bookingItemId: input.bookingItemId,
          compositionRuleId: proposal.compositionRuleId ?? null,
          selectedAlternativeId: proposal.selectedAlternativeId ?? null,
          parentRequirementId: proposal.parentRequirementKey ? createdByKey.get(proposal.parentRequirementKey) ?? null : null,
          requirementKey: proposal.requirementKey,
          role: proposal.role,
          selectionSource: proposal.selectionSource,
          status: FulfillmentRequirementStatus.PLANNED,
          productId: proposal.productId,
          variantSizeId: proposal.variantSizeId,
          sourceLocationId: availability.sourceLocationId,
          trackingModeSnapshot: availability.trackingMode,
          availabilityPolicySnapshot: this.json(availability.availabilityPolicy)!,
          quantity: proposal.quantity,
          productNameSnapshot: proposal.productName,
          variantNameSnapshot: proposal.variantName,
          sizeSnapshot: proposal.sizeLabel,
          ruleSnapshot: proposal.ruleSnapshot,
          customerSelectionSnapshot: proposal.customerSelectionSnapshot,
          rentalStartDate: new Date(input.startDate),
          rentalEndDate: new Date(input.endDate),
          blockedStartDate: new Date(input.startDate),
          blockedEndDate: new Date(input.endDate),
          priceAdjustment: proposal.priceAdjustment,
          revenueAllocation: proposal.requirementKey === 'MAIN' ? mainRevenue : Math.max(0, proposal.priceAdjustment),
        },
      });
      createdByKey.set(proposal.requirementKey, requirement.id);

      await tx.fulfillmentRequirementVersion.create({
        data: {
          tenantId: input.tenantId,
          requirementId: requirement.id,
          version: 1,
          action: FulfillmentVersionAction.CREATED,
          productId: proposal.productId,
          variantSizeId: proposal.variantSizeId,
          quantity: proposal.quantity,
          rentalStartDate: new Date(input.startDate),
          rentalEndDate: new Date(input.endDate),
          blockedStartDate: new Date(input.startDate),
          blockedEndDate: new Date(input.endDate),
          selectionSource: proposal.selectionSource,
          snapshot: proposal.ruleSnapshot,
          reason: 'Created from booking composition snapshot',
          priceImpact: proposal.priceAdjustment,
        },
      });

      const reservation = await this.reservations.create(tx, {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        bookingItemId: input.bookingItemId,
        fulfillmentRequirementId: requirement.id,
        productId: proposal.productId,
        variantSizeId: proposal.variantSizeId,
        sourceLocationId: availability.sourceLocationId,
        quantity: proposal.quantity,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.reservationStatus,
        expiresAt: input.expiresAt,
      });
      await tx.fulfillmentRequirementVersion.update({
        where: { requirementId_version: { requirementId: requirement.id, version: 1 } },
        data: {
          rentalStartDate: reservation.rentalStartDate,
          rentalEndDate: reservation.rentalEndDate,
          blockedStartDate: reservation.blockedStartDate,
          blockedEndDate: reservation.blockedEndDate,
        },
      });
      await tx.fulfillmentRequirement.update({
        where: { id: requirement.id },
        data: {
          status: FulfillmentRequirementStatus.RESERVED,
          rentalStartDate: reservation.rentalStartDate,
          rentalEndDate: reservation.rentalEndDate,
          blockedStartDate: reservation.blockedStartDate,
          blockedEndDate: reservation.blockedEndDate,
        },
      });
      await tx.fulfillmentRequirementEvent.create({
        data: {
          tenantId: input.tenantId,
          requirementId: requirement.id,
          eventType: FulfillmentEventType.RESERVED,
          quantity: proposal.quantity,
          fromStatus: FulfillmentRequirementStatus.PLANNED,
          toStatus: FulfillmentRequirementStatus.RESERVED,
          reason: 'Inventory reserved with booking',
        },
      });
      if (proposal.compositionRuleId) {
        await tx.fulfillmentSelectionSnapshot.create({
          data: {
            tenantId: input.tenantId,
            bookingItemId: input.bookingItemId,
            requirementId: requirement.id,
            compositionRuleId: proposal.compositionRuleId,
            productId: proposal.productId,
            variantSizeId: proposal.variantSizeId,
            quantity: proposal.quantity,
            selectedBy: proposal.selectionSource,
            selectionSnapshot: proposal.customerSelectionSnapshot ?? proposal.ruleSnapshot,
          },
        });
      }
    }
  }

  async listBookingRequirements(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId }, select: { id: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.prisma.fulfillmentRequirement.findMany({
      where: { tenantId, bookingId },
      include: this.requirementInclude(),
      orderBy: [{ bookingItemId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async extendBookingRequirements(
    tenantId: string,
    bookingId: string,
    dto: ExtendFulfillmentRequirementDto,
    actorUserId?: string,
  ) {
    const requestedEnd = new Date(dto.rentalEndDate);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM fulfillment_requirements
        WHERE tenant_id = ${tenantId} AND booking_id = ${bookingId}
        ORDER BY variant_size_id NULLS LAST, id
        FOR UPDATE
      `);
      const requirements = await tx.fulfillmentRequirement.findMany({
        where: {
          tenantId,
          bookingId,
          status: { notIn: ['CANCELLED', 'SUPERSEDED', 'RETURNED', 'LOST'] },
        },
        include: { reservation: true },
        orderBy: [{ variantSizeId: 'asc' }, { id: 'asc' }],
      });
      if (!requirements.length) throw new NotFoundException('No active fulfillment requirements were found');
      if (requirements.some((item) => !item.productId || !item.variantSizeId || !item.reservation)) {
        throw new ConflictException('Resolve every fulfillment component before changing rental dates');
      }
      if (requirements.some((item) => requestedEnd <= item.rentalStartDate)) {
        throw new BadRequestException('Rental end date must be after the rental start date');
      }
      if (requirements.some((item) => item.handedOutQuantity > 0 && requestedEnd < item.rentalEndDate)) {
        throw new ConflictException('A handed-out component cannot be shortened below its current return date');
      }

      await this.reservations.lockVariantSizes(
        tx,
        tenantId,
        requirements.flatMap((item) => item.variantSizeId ? [item.variantSizeId] : []),
      );
      const checks = [] as Array<{
        requirement: (typeof requirements)[number];
        availability: Awaited<ReturnType<InventoryAvailabilityService['check']>>;
      }>;
      for (const requirement of requirements) {
        const availability = await this.availability.check({
          tenantId,
          productId: requirement.productId!,
          variantSizeId: requirement.variantSizeId!,
          sourceLocationId: requirement.sourceLocationId,
          startDate: requirement.rentalStartDate,
          endDate: requestedEnd,
          quantity: requirement.quantity,
          enforcePublished: false,
          excludeReservationId: requirement.reservation!.id,
        }, tx);
        if (!availability.available || !availability.availabilityPolicy) {
          throw new ConflictException(
            `${requirement.productNameSnapshot} cannot be extended: ${availability.reason ?? 'inventory is unavailable'}`,
          );
        }
        checks.push({ requirement, availability });
      }

      for (const { requirement, availability } of checks) {
        const nextVersion = requirement.currentVersion + 1;
        const wasOverdue = requirement.status === FulfillmentRequirementStatus.OVERDUE;
        const nextStatus = wasOverdue
          ? (requirement.handedOutQuantity === requirement.quantity
            ? FulfillmentRequirementStatus.HANDED_OUT
            : FulfillmentRequirementStatus.RESERVED)
          : requirement.status;
        await tx.inventoryReservation.update({
          where: { id: requirement.reservation!.id },
          data: {
            rentalEndDate: new Date(availability.rentalRange.end),
            blockedStartDate: new Date(availability.effectiveBlockedRange.start),
            blockedEndDate: new Date(availability.effectiveBlockedRange.end),
          },
        });
        await tx.fulfillmentRequirementVersion.create({
          data: {
            tenantId,
            requirementId: requirement.id,
            version: nextVersion,
            action: wasOverdue ? FulfillmentVersionAction.OVERDUE_EXTENDED : FulfillmentVersionAction.MODIFIED,
            productId: requirement.productId,
            variantSizeId: requirement.variantSizeId,
            quantity: requirement.quantity,
            rentalStartDate: requirement.rentalStartDate,
            rentalEndDate: new Date(availability.rentalRange.end),
            blockedStartDate: new Date(availability.effectiveBlockedRange.start),
            blockedEndDate: new Date(availability.effectiveBlockedRange.end),
            selectionSource: requirement.selectionSource,
            snapshot: this.json({ previousRentalEndDate: requirement.rentalEndDate }),
            reason: dto.reason.trim(),
            actorUserId: actorUserId ?? null,
          },
        });
        await tx.fulfillmentRequirement.update({
          where: { id: requirement.id },
          data: {
            currentVersion: nextVersion,
            rentalEndDate: new Date(availability.rentalRange.end),
            blockedStartDate: new Date(availability.effectiveBlockedRange.start),
            blockedEndDate: new Date(availability.effectiveBlockedRange.end),
            availabilityPolicySnapshot: this.json(availability.availabilityPolicy),
            status: nextStatus,
          },
        });
        if (wasOverdue) {
          await tx.fulfillmentRequirementEvent.create({
            data: {
              tenantId,
              requirementId: requirement.id,
              eventType: FulfillmentEventType.OVERDUE_RESOLVED,
              quantity: Math.max(1, requirement.handedOutQuantity - requirement.returnedQuantity - requirement.lostQuantity),
              fromStatus: requirement.status,
              toStatus: nextStatus,
              reason: dto.reason.trim(),
              actorUserId: actorUserId ?? null,
            },
          });
        }
      }
      return tx.fulfillmentRequirement.findMany({
        where: { tenantId, bookingId },
        include: this.requirementInclude(),
        orderBy: [{ bookingItemId: 'asc' }, { createdAt: 'asc' }],
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assertAndTransitionBooking(
    tx: Transaction,
    tenantId: string,
    bookingId: string,
    bookingStatus: 'pending' | 'confirmed' | 'delivered' | 'returned' | 'inspected' | 'completed' | 'cancelled' | 'overdue',
    reason?: string,
  ) {
    const requirements = await tx.fulfillmentRequirement.findMany({
      where: { tenantId, bookingId, status: { notIn: ['CANCELLED', 'SUPERSEDED'] } },
    });
    if (!requirements.length) {
      throw new ConflictException('Booking has no fulfillment requirements');
    }
    if (bookingStatus === 'confirmed') {
      const unresolved = requirements.find((item) => !item.variantSizeId || !['RESERVED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(item.status));
      if (unresolved) throw new ConflictException('Every required component must be resolved and reserved before confirmation');
      return;
    }
    if (bookingStatus === 'delivered') {
      const unpacked = requirements.find((item) => item.handedOutQuantity !== item.quantity);
      if (unpacked) throw new ConflictException('Every fulfillment component must be handed out before delivery');
      return;
    }
    if (bookingStatus === 'returned' || bookingStatus === 'inspected' || bookingStatus === 'completed') {
      const unresolved = requirements.find((item) => item.returnedQuantity + item.lostQuantity !== item.quantity);
      if (unresolved) throw new ConflictException('Every fulfillment component must be returned or resolved as lost first');
      return;
    }
    if (bookingStatus === 'cancelled') {
      const operational = requirements.find((item) => item.handedOutQuantity > item.returnedQuantity + item.lostQuantity);
      if (operational) throw new ConflictException('Handed-out components require return or loss resolution before cancellation');
      for (const requirement of requirements) {
        await tx.fulfillmentRequirement.update({
          where: { id: requirement.id },
          data: { status: FulfillmentRequirementStatus.CANCELLED },
        });
        await tx.fulfillmentRequirementEvent.create({
          data: {
            tenantId,
            requirementId: requirement.id,
            eventType: FulfillmentEventType.CANCELLED,
            quantity: requirement.quantity,
            fromStatus: requirement.status,
            toStatus: FulfillmentRequirementStatus.CANCELLED,
            reason: reason?.trim() || 'Booking cancelled',
          },
        });
      }
      return;
    }
    if (bookingStatus === 'overdue') {
      for (const requirement of requirements.filter((item) => item.handedOutQuantity > item.returnedQuantity + item.lostQuantity)) {
        await tx.fulfillmentRequirement.update({ where: { id: requirement.id }, data: { status: FulfillmentRequirementStatus.OVERDUE } });
        await tx.fulfillmentRequirementEvent.create({
          data: {
            tenantId,
            requirementId: requirement.id,
            eventType: FulfillmentEventType.OVERDUE,
            quantity: requirement.handedOutQuantity - requirement.returnedQuantity - requirement.lostQuantity,
            fromStatus: requirement.status,
            toStatus: FulfillmentRequirementStatus.OVERDUE,
            reason: reason?.trim() || 'Booking marked overdue',
          },
        });
      }
    }
  }

  async substitute(
    tenantId: string,
    requirementId: string,
    dto: SubstituteFulfillmentRequirementDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM fulfillment_requirements
        WHERE tenant_id = ${tenantId} AND id = ${requirementId}
        FOR UPDATE
      `);
      const requirement = await tx.fulfillmentRequirement.findFirst({
        where: { id: requirementId, tenantId },
        include: { reservation: true, compositionRule: { include: { alternatives: { where: { isActive: true } } } } },
      });
      if (!requirement) throw new NotFoundException('Fulfillment requirement not found');
      if (['HANDED_OUT', 'PARTIALLY_HANDED_OUT', 'PARTIALLY_RETURNED', 'RETURNED', 'LOST', 'CANCELLED', 'SUPERSEDED'].includes(requirement.status)) {
        throw new ConflictException('This requirement can no longer be substituted');
      }
      const activeAssignments = requirement.reservation
        ? await tx.stockUnitAssignment.count({ where: { tenantId, reservationId: requirement.reservation.id, releasedAt: null } })
        : 0;
      if (activeAssignments > 0) throw new ConflictException('Release assigned physical units before substitution');

      await this.validateSubstitution(tx, tenantId, requirement, dto);
      await this.reservations.lockVariantSizes(tx, tenantId, [dto.variantSizeId, ...(requirement.variantSizeId ? [requirement.variantSizeId] : [])]);
      const availability = await this.availability.check({
        tenantId,
        productId: dto.productId,
        variantSizeId: dto.variantSizeId,
        startDate: requirement.rentalStartDate,
        endDate: requirement.rentalEndDate,
        quantity: requirement.quantity,
        enforcePublished: false,
        excludeReservationId: requirement.reservation?.id,
      }, tx);
      if (!availability.available || !availability.sourceLocationId || !availability.availabilityPolicy) {
        throw new ConflictException(availability.reason ?? 'Substitute inventory is unavailable');
      }

      const targetSku = await this.getSku(tx, tenantId, dto.productId, dto.variantSizeId);
      const nextVersion = requirement.currentVersion + 1;
      const approvalStatus = this.resolveSubstitutionApproval(requirement.compositionRule?.substitutionPolicy, dto.approvalStatus);
      if (requirement.reservation) {
        await tx.inventoryReservation.update({
          where: { id: requirement.reservation.id },
          data: {
            productId: dto.productId,
            variantSizeId: dto.variantSizeId,
            sourceLocationId: availability.sourceLocationId,
            inventoryPoolId: availability.inventoryPoolId,
            rentalStartDate: new Date(availability.rentalRange.start),
            rentalEndDate: new Date(availability.rentalRange.end),
            blockedStartDate: new Date(availability.effectiveBlockedRange.start),
            blockedEndDate: new Date(availability.effectiveBlockedRange.end),
          },
        });
      } else {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: requirement.bookingId }, select: { status: true } });
        await tx.inventoryReservation.create({
          data: {
            tenantId,
            bookingId: requirement.bookingId,
            bookingItemId: requirement.bookingItemId,
            fulfillmentRequirementId: requirement.id,
            productId: dto.productId,
            variantSizeId: dto.variantSizeId,
            sourceLocationId: availability.sourceLocationId,
            inventoryPoolId: availability.inventoryPoolId,
            quantity: requirement.quantity,
            rentalStartDate: new Date(availability.rentalRange.start),
            rentalEndDate: new Date(availability.rentalRange.end),
            blockedStartDate: new Date(availability.effectiveBlockedRange.start),
            blockedEndDate: new Date(availability.effectiveBlockedRange.end),
            status: booking.status === 'confirmed' ? 'CONFIRMED' : 'PENDING',
          },
        });
      }

      await tx.fulfillmentRequirementVersion.create({
        data: {
          tenantId,
          requirementId,
          version: nextVersion,
          action: FulfillmentVersionAction.SUBSTITUTED,
          productId: dto.productId,
          variantSizeId: dto.variantSizeId,
          quantity: requirement.quantity,
          rentalStartDate: new Date(availability.rentalRange.start),
          rentalEndDate: new Date(availability.rentalRange.end),
          blockedStartDate: new Date(availability.effectiveBlockedRange.start),
          blockedEndDate: new Date(availability.effectiveBlockedRange.end),
          selectionSource: FulfillmentSelectionSource.SUBSTITUTION,
          snapshot: this.json({ compatibilityResult: dto.compatibilityResult, approvalStatus }),
          reason: dto.reason.trim(),
          priceImpact: dto.priceImpact,
          actorUserId: actorUserId ?? null,
        },
      });
      await tx.fulfillmentSubstitution.create({
        data: {
          tenantId,
          requirementId,
          fromVersion: requirement.currentVersion,
          toVersion: nextVersion,
          fromProductId: requirement.productId ?? dto.productId,
          fromVariantSizeId: requirement.variantSizeId ?? dto.variantSizeId,
          toProductId: dto.productId,
          toVariantSizeId: dto.variantSizeId,
          compatibilityResult: this.json(dto.compatibilityResult),
          approvalStatus,
          customerApprovedAt: approvalStatus === FulfillmentApprovalStatus.APPROVED ? new Date() : null,
          priceImpact: dto.priceImpact,
          reason: dto.reason.trim(),
          actorUserId: actorUserId ?? null,
        },
      });
      return tx.fulfillmentRequirement.update({
        where: { id: requirementId },
        data: {
          productId: dto.productId,
          variantSizeId: dto.variantSizeId,
          sourceLocationId: availability.sourceLocationId,
          trackingModeSnapshot: availability.trackingMode,
          availabilityPolicySnapshot: this.json(availability.availabilityPolicy),
          productNameSnapshot: targetSku.variant.product.name,
          variantNameSnapshot: targetSku.variant.variantName,
          sizeSnapshot: targetSku.sizeInstance.displayLabel,
          selectionSource: FulfillmentSelectionSource.SUBSTITUTION,
          status: FulfillmentRequirementStatus.RESERVED,
          currentVersion: nextVersion,
          priceAdjustment: { increment: dto.priceImpact },
          rentalStartDate: new Date(availability.rentalRange.start),
          rentalEndDate: new Date(availability.rentalRange.end),
          blockedStartDate: new Date(availability.effectiveBlockedRange.start),
          blockedEndDate: new Date(availability.effectiveBlockedRange.end),
        },
        include: this.requirementInclude(),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recordEvent(
    tenantId: string,
    requirementId: string,
    dto: RecordFulfillmentEventDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.fulfillmentRequirementEvent.findFirst({ where: { tenantId, idempotencyKey: dto.idempotencyKey } });
        if (existing) {
          if (existing.requirementId !== requirementId || existing.eventType !== dto.eventType || existing.quantity !== dto.quantity) {
            throw new ConflictException('The idempotency key belongs to another fulfillment event');
          }
          return tx.fulfillmentRequirement.findUniqueOrThrow({ where: { id: requirementId }, include: this.requirementInclude() });
        }
      }
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM fulfillment_requirements
        WHERE tenant_id = ${tenantId} AND id = ${requirementId}
        FOR UPDATE
      `);
      const requirement = await tx.fulfillmentRequirement.findFirst({
        where: { id: requirementId, tenantId },
        include: { variantSize: true, reservation: true },
      });
      if (!requirement) throw new NotFoundException('Fulfillment requirement not found');
      if (!requirement.variantSize || !requirement.reservation) throw new ConflictException('Requirement inventory is not resolved');
      const supportedEvents: FulfillmentEventType[] = [
        FulfillmentEventType.HANDED_OUT,
        FulfillmentEventType.RETURNED,
        FulfillmentEventType.MARKED_LOST,
      ];
      if (!supportedEvents.includes(dto.eventType)) {
        throw new BadRequestException('This event must be recorded by its dedicated workflow');
      }

      const assignments = await this.resolveEventAssignments(tx, tenantId, {
        id: requirement.id,
        variantSize: requirement.variantSize,
        reservation: requirement.reservation,
      }, dto);
      const next = this.nextCounters(requirement, dto.eventType, dto.quantity);
      for (const assignment of assignments) {
        if (dto.eventType === FulfillmentEventType.HANDED_OUT) {
          await this.lifecycle.transitionInTransaction(tx, {
            tenantId,
            stockUnitId: assignment.stockUnitId,
            actorUserId,
            assignmentId: assignment.id,
            targetOperationalState: StockUnitOperationalState.OUT_FOR_RENTAL,
            reason: dto.reason.trim(),
          });
        } else if (dto.eventType === FulfillmentEventType.RETURNED) {
          await this.lifecycle.transitionInTransaction(tx, {
            tenantId,
            stockUnitId: assignment.stockUnitId,
            actorUserId,
            assignmentId: assignment.id,
            targetOperationalState: StockUnitOperationalState.AWAITING_INSPECTION,
            reason: dto.reason.trim(),
          });
        } else {
          await this.lifecycle.transitionInTransaction(tx, {
            tenantId,
            stockUnitId: assignment.stockUnitId,
            actorUserId,
            assignmentId: assignment.id,
            targetDisposition: StockUnitDisposition.LOST,
            reason: dto.reason.trim(),
          });
        }
      }
      if (dto.eventType === FulfillmentEventType.RETURNED || dto.eventType === FulfillmentEventType.MARKED_LOST) {
        await tx.stockUnitAssignment.updateMany({
          where: { id: { in: assignments.map((assignment) => assignment.id) }, releasedAt: null },
          data: { releasedAt: new Date(), releaseReason: dto.reason.trim() },
        });
      }
      await tx.fulfillmentRequirement.update({ where: { id: requirementId }, data: next.data });
      await tx.fulfillmentRequirementEvent.create({
        data: {
          tenantId,
          requirementId,
          eventType: dto.eventType,
          quantity: dto.quantity,
          fromStatus: requirement.status,
          toStatus: next.status,
          reason: dto.reason.trim(),
          actorUserId: actorUserId ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
          metadata: this.json({ assignmentIds: assignments.map((assignment) => assignment.id) }),
        },
      });
      return tx.fulfillmentRequirement.findUniqueOrThrow({ where: { id: requirementId }, include: this.requirementInclude() });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async expandProductRules(
    tx: Transaction,
    tenantId: string,
    productId: string,
    parentSku: Awaited<ReturnType<FulfillmentService['getSku']>>,
    parentQuantity: number,
    parentKey: string,
    selections: Map<string, FulfillmentSelectionDto>,
    proposals: RequirementProposal[],
    path: Set<string>,
    depth: number,
  ): Promise<void> {
    if (depth >= MAX_COMPOSITION_DEPTH) {
      const deeperRule = await tx.productCompositionRule.findFirst({
        where: { tenantId, parentProductId: productId, isActive: true },
        select: { id: true },
      });
      if (deeperRule) throw new ConflictException(`Product composition exceeds the maximum depth of ${MAX_COMPOSITION_DEPTH}`);
      return;
    }
    const rules = await tx.productCompositionRule.findMany({
      where: { tenantId, parentProductId: productId, isActive: true },
      include: this.compositionInclude(),
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    for (const rule of rules) {
      const selection = selections.get(rule.id);
      if (rule.role === ProductCompositionRole.OPTIONAL_ADDON && !selection && !rule.isDefaultSelected) continue;
      const resolved = await this.resolveRule(tx, tenantId, rule, parentSku, selection);
      if (!resolved) {
        if (rule.role === ProductCompositionRole.REQUIRED_COMPONENT) {
          throw new ConflictException(`Required component "${rule.name}" needs a valid SKU selection`);
        }
        continue;
      }
      if (path.has(resolved.productId)) throw new ConflictException('Product composition contains a cycle');
      const quantityPerParent = rule.role === ProductCompositionRole.OPTIONAL_ADDON && selection?.quantity
        ? selection.quantity
        : rule.quantity;
      if (quantityPerParent < 1 || quantityPerParent > 100) throw new BadRequestException('Component quantity must be between 1 and 100');
      const quantity = parentQuantity * quantityPerParent;
      const requirementKey = `${parentKey}/RULE:${rule.id}`;
      const sku = await this.getSku(tx, tenantId, resolved.productId, resolved.variantSizeId);
      const priceAdjustment = rule.pricingBehavior === CompositionPricingBehavior.INCLUDED
        ? 0
        : (rule.priceAdjustment + resolved.alternativePriceAdjustment) * quantity;
      proposals.push({
        requirementKey,
        parentRequirementKey: parentKey,
        compositionRuleId: rule.id,
        selectedAlternativeId: resolved.alternativeId,
        role: rule.role,
        selectionSource: resolved.selectionSource,
        productId: resolved.productId,
        variantSizeId: resolved.variantSizeId,
        quantity,
        productName: sku.variant.product.name,
        variantName: sku.variant.variantName,
        sizeLabel: sku.sizeInstance.displayLabel,
        priceAdjustment,
        ruleSnapshot: this.json({
          id: rule.id,
          name: rule.name,
          role: rule.role,
          quantity: rule.quantity,
          skuResolution: rule.skuResolution,
          substitutionPolicy: rule.substitutionPolicy,
          pricingBehavior: rule.pricingBehavior,
          priceAdjustment: rule.priceAdjustment,
          customerApprovalRequired: rule.customerApprovalRequired,
          compatibilityRules: rule.compatibilityRules,
          configurationVersion: rule.configurationVersion,
        }),
        customerSelectionSnapshot: selection ? this.json(selection) : undefined,
      });
      await this.expandProductRules(
        tx,
        tenantId,
        resolved.productId,
        sku,
        quantity,
        requirementKey,
        selections,
        proposals,
        new Set(path).add(resolved.productId),
        depth + 1,
      );
    }
  }

  private async resolveRule(
    tx: Transaction,
    tenantId: string,
    rule: CompositionRule,
    parentSku: Awaited<ReturnType<FulfillmentService['getSku']>>,
    selection?: FulfillmentSelectionDto,
  ): Promise<{ productId: string; variantSizeId: string; alternativeId?: string; alternativePriceAdjustment: number; selectionSource: FulfillmentSelectionSource } | null> {
    if (rule.skuResolution === CompositionSkuResolution.FIXED) {
      if (!rule.componentProductId || !rule.fixedVariantSizeId) return null;
      return { productId: rule.componentProductId, variantSizeId: rule.fixedVariantSizeId, alternativePriceAdjustment: 0, selectionSource: FulfillmentSelectionSource.FIXED_RULE };
    }
    if (rule.skuResolution === CompositionSkuResolution.PARENT_DERIVED) {
      if (!rule.componentProductId) return null;
      const sku = await tx.variantSize.findFirst({
        where: {
          tenantId,
          variant: { productId: rule.componentProductId },
          sizeInstance: { normalizedKey: parentSku.sizeInstance.normalizedKey },
        },
        orderBy: [{ variant: { sequence: 'asc' } }, { id: 'asc' }],
        select: { id: true },
      });
      return sku ? { productId: rule.componentProductId, variantSizeId: sku.id, alternativePriceAdjustment: 0, selectionSource: FulfillmentSelectionSource.PARENT_DERIVED } : null;
    }
    if (rule.skuResolution === CompositionSkuResolution.STAFF_SELECTED && !selection?.variantSizeId) {
      if (!rule.componentProductId) return null;
      const fallbackSku = await tx.variantSize.findFirst({
        where: {
          tenantId,
          variant: { productId: rule.componentProductId, product: { deletedAt: null } },
          OR: [
            { trackingMode: InventoryTrackingMode.POOLED, pooledQuantity: { gt: 0 } },
            { trackingMode: InventoryTrackingMode.SERIALIZED, stockUnits: { some: { disposition: 'ACTIVE', deletedAt: null } } },
          ],
        },
        orderBy: [{ variant: { sequence: 'asc' } }, { id: 'asc' }],
        select: { id: true },
      });
      return fallbackSku
        ? { productId: rule.componentProductId, variantSizeId: fallbackSku.id, alternativePriceAdjustment: 0, selectionSource: FulfillmentSelectionSource.STAFF }
        : null;
    }
    if (!selection?.variantSizeId) {
      const defaultSku = rule.isDefaultSelected
        ? rule.fixedVariantSizeId ?? rule.alternatives.find((alternative) => alternative.variantSizeId)?.variantSizeId
        : null;
      if (!defaultSku) return null;
      const alternative = rule.alternatives.find((item) => item.variantSizeId === defaultSku);
      return {
        productId: alternative?.productId ?? rule.componentProductId!,
        variantSizeId: defaultSku,
        alternativeId: alternative?.id,
        alternativePriceAdjustment: alternative?.priceAdjustment ?? 0,
        selectionSource: rule.skuResolution === CompositionSkuResolution.STAFF_SELECTED ? FulfillmentSelectionSource.STAFF : FulfillmentSelectionSource.CUSTOMER,
      };
    }
    const selectedProductId = selection.productId ?? rule.componentProductId;
    if (!selectedProductId) throw new BadRequestException(`Component "${rule.name}" requires a product selection`);
    const alternative = rule.alternatives.find((item) => item.productId === selectedProductId && (!item.variantSizeId || item.variantSizeId === selection.variantSizeId));
    if (selectedProductId !== rule.componentProductId && !alternative) {
      throw new BadRequestException(`Selection is not an allowed alternative for "${rule.name}"`);
    }
    await this.getSku(tx, tenantId, selectedProductId, selection.variantSizeId);
    return {
      productId: selectedProductId,
      variantSizeId: selection.variantSizeId,
      alternativeId: alternative?.id,
      alternativePriceAdjustment: alternative?.priceAdjustment ?? 0,
      selectionSource: rule.skuResolution === CompositionSkuResolution.STAFF_SELECTED ? FulfillmentSelectionSource.STAFF : FulfillmentSelectionSource.CUSTOMER,
    };
  }

  private async validateSubstitution(
    tx: Transaction,
    tenantId: string,
    requirement: Prisma.FulfillmentRequirementGetPayload<{ include: { reservation: true; compositionRule: { include: { alternatives: true } } } }>,
    dto: SubstituteFulfillmentRequirementDto,
  ) {
    await this.getSku(tx, tenantId, dto.productId, dto.variantSizeId);
    const rule = requirement.compositionRule;
    if (!rule) return;
    if (requirement.variantSizeId && rule.substitutionPolicy === CompositionSubstitutionPolicy.NOT_ALLOWED) {
      throw new ConflictException('Substitution is not allowed for this component');
    }
    const allowedProduct = dto.productId === rule.componentProductId || rule.alternatives.some((alternative) => alternative.isActive && alternative.productId === dto.productId && (!alternative.variantSizeId || alternative.variantSizeId === dto.variantSizeId));
    if (!allowedProduct) throw new ConflictException('Selected substitute is not an allowed alternative');
  }

  private resolveSubstitutionApproval(
    policy: CompositionSubstitutionPolicy | undefined,
    requested: FulfillmentApprovalStatus | undefined,
  ) {
    if (policy === CompositionSubstitutionPolicy.CUSTOMER_APPROVAL) {
      if (requested !== FulfillmentApprovalStatus.APPROVED) {
        throw new ConflictException('Customer approval is required before this substitution can be applied');
      }
      return FulfillmentApprovalStatus.APPROVED;
    }
    return requested ?? FulfillmentApprovalStatus.NOT_REQUIRED;
  }

  private async resolveEventAssignments(
    tx: Transaction,
    tenantId: string,
    requirement: { id: string; reservation: { id: string }; variantSize: { trackingMode: InventoryTrackingMode } },
    dto: RecordFulfillmentEventDto,
  ) {
    if (requirement.variantSize.trackingMode === InventoryTrackingMode.POOLED) {
      if (dto.assignmentIds?.length) throw new BadRequestException('Pooled requirements do not use physical-unit assignments');
      return [];
    }
    const ids = [...new Set(dto.assignmentIds ?? [])];
    if (ids.length !== dto.quantity) throw new BadRequestException('Select one physical-unit assignment for each serialized item');
    const priorEvents = await tx.fulfillmentRequirementEvent.findMany({
      where: {
        tenantId,
        requirementId: requirement.id,
        eventType: { in: [FulfillmentEventType.HANDED_OUT, FulfillmentEventType.RETURNED, FulfillmentEventType.MARKED_LOST] },
      },
      select: { eventType: true, metadata: true },
    });
    const assignmentIdsFor = (eventType: FulfillmentEventType) => new Set(
      priorEvents
        .filter((event) => event.eventType === eventType)
        .flatMap((event) => {
          const metadata = event.metadata as { assignmentIds?: unknown } | null;
          return Array.isArray(metadata?.assignmentIds)
            ? metadata.assignmentIds.filter((id): id is string => typeof id === 'string')
            : [];
        }),
    );
    const handedOutIds = assignmentIdsFor(FulfillmentEventType.HANDED_OUT);
    const resolvedIds = new Set([
      ...assignmentIdsFor(FulfillmentEventType.RETURNED),
      ...assignmentIdsFor(FulfillmentEventType.MARKED_LOST),
    ]);
    if (dto.eventType === FulfillmentEventType.HANDED_OUT && ids.some((id) => handedOutIds.has(id) && !resolvedIds.has(id))) {
      throw new ConflictException('One or more physical units were already handed out');
    }
    if (dto.eventType !== FulfillmentEventType.HANDED_OUT && ids.some((id) => !handedOutIds.has(id) || resolvedIds.has(id))) {
      throw new ConflictException('Return or loss can only be recorded once for a handed-out physical unit');
    }
    const assignments = await tx.stockUnitAssignment.findMany({
      where: { id: { in: ids }, tenantId, reservationId: requirement.reservation.id, releasedAt: null },
      select: { id: true, stockUnitId: true },
    });
    if (assignments.length !== ids.length) throw new ConflictException('One or more physical-unit assignments are not active for this requirement');
    return assignments;
  }

  private nextCounters(
    requirement: { quantity: number; assignedQuantity: number; handedOutQuantity: number; returnedQuantity: number; lostQuantity: number },
    eventType: FulfillmentEventType,
    quantity: number,
  ): { status: FulfillmentRequirementStatus; data: Prisma.FulfillmentRequirementUpdateInput } {
    if (eventType === FulfillmentEventType.HANDED_OUT) {
      if (requirement.handedOutQuantity + quantity > requirement.quantity) throw new ConflictException('Handout quantity exceeds the requirement');
      const handedOutQuantity = requirement.handedOutQuantity + quantity;
      const status = handedOutQuantity === requirement.quantity ? FulfillmentRequirementStatus.HANDED_OUT : FulfillmentRequirementStatus.PARTIALLY_HANDED_OUT;
      return { status, data: { handedOutQuantity, status } };
    }
    const unresolved = requirement.handedOutQuantity - requirement.returnedQuantity - requirement.lostQuantity;
    if (quantity > unresolved) throw new ConflictException('Return or loss quantity exceeds the handed-out quantity');
    const returnedQuantity = requirement.returnedQuantity + (eventType === FulfillmentEventType.RETURNED ? quantity : 0);
    const lostQuantity = requirement.lostQuantity + (eventType === FulfillmentEventType.MARKED_LOST ? quantity : 0);
    const resolved = returnedQuantity + lostQuantity;
    const status = resolved === requirement.quantity
      ? (lostQuantity > 0 ? FulfillmentRequirementStatus.LOST : FulfillmentRequirementStatus.RETURNED)
      : FulfillmentRequirementStatus.PARTIALLY_RETURNED;
    return {
      status,
      data: {
        returnedQuantity,
        lostQuantity,
        assignedQuantity: Math.max(0, requirement.assignedQuantity - quantity),
        status,
      },
    };
  }

  private getSku(tx: Transaction, tenantId: string, productId: string, variantSizeId: string) {
    return tx.variantSize.findFirstOrThrow({
      where: { id: variantSizeId, tenantId, variant: { productId, product: { deletedAt: null } } },
      include: { sizeInstance: true, variant: { include: { mainColor: true, product: true } } },
    });
  }

  private compositionInclude() {
    return {
      componentProduct: { select: { id: true, name: true } },
      fixedVariantSize: { include: { sizeInstance: true, variant: { include: { mainColor: true, product: true } } } },
      alternatives: {
        where: { isActive: true },
        include: {
          product: { select: { id: true, name: true } },
          variantSize: { include: { sizeInstance: true, variant: { include: { mainColor: true, product: true } } } },
        },
        orderBy: [{ priority: 'asc' as const }, { id: 'asc' as const }],
      },
    } satisfies Prisma.ProductCompositionRuleInclude;
  }

  private requirementInclude() {
    return {
      reservation: {
        include: {
          assignments: {
            include: { stockUnit: true },
            orderBy: { assignedAt: 'asc' as const },
          },
        },
      },
      variantSize: {
        select: {
          id: true,
          trackingMode: true,
          sizeInstance: { select: { displayLabel: true } },
          variant: { select: { id: true, variantName: true } },
        },
      },
      compositionRule: true,
      versions: { orderBy: { version: 'desc' as const } },
      substitutions: { orderBy: { createdAt: 'desc' as const } },
      events: { include: { actor: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' as const } },
    } satisfies Prisma.FulfillmentRequirementInclude;
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
