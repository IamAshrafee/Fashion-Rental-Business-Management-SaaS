import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryServiceOrderType,
  Prisma,
  StockUnitDisposition,
  StockUnitInspectionDecision,
  StockUnitInspectionStatus,
  StockUnitInspectionType,
  StockUnitIssueSeverity,
  StockUnitIssueStatus,
  StockUnitOperationalState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompleteStockUnitInspectionDto,
  CreateStockUnitInspectionDto,
  InspectionIssueInputDto,
  ResolveStockUnitIssueDto,
} from './dto/inventory-operations.dto';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';

const BLOCKING_INSPECTION_TYPES = new Set<StockUnitInspectionType>([
  StockUnitInspectionType.RETURN,
  StockUnitInspectionType.PERIODIC,
]);

const ASSIGNMENT_INSPECTION_TYPES = new Set<StockUnitInspectionType>([
  StockUnitInspectionType.PRE_RENTAL,
  StockUnitInspectionType.RETURN,
]);

const TERMINAL_ISSUE_STATUSES = new Set<StockUnitIssueStatus>([
  StockUnitIssueStatus.RESOLVED,
  StockUnitIssueStatus.WAIVED,
]);

const DEFAULT_BLOCKING_ISSUE_SEVERITIES = new Set<StockUnitIssueSeverity>([
  StockUnitIssueSeverity.MODERATE,
  StockUnitIssueSeverity.SEVERE,
  StockUnitIssueSeverity.CRITICAL,
]);

@Injectable()
export class StockUnitInspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: StockUnitLifecycleService,
  ) {}

  async create(
    tenantId: string,
    stockUnitId: string,
    dto: CreateStockUnitInspectionDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.stockUnitInspection.findFirst({
          where: { tenantId, createIdempotencyKey: dto.idempotencyKey },
          include: this.inspectionInclude(),
        });
        if (existing) {
          if (
            existing.stockUnitId !== stockUnitId ||
            existing.inspectionType !== dto.inspectionType
          ) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'The idempotency key belongs to another inspection',
            });
          }
          return existing;
        }
      }

      const unit = await tx.stockUnit.findFirst({
        where: { id: stockUnitId, tenantId, deletedAt: null },
      });
      if (!unit) throw new NotFoundException('Stock unit not found');
      if (unit.disposition === StockUnitDisposition.RETIRED) {
        throw new ConflictException('Retired units cannot start new inspections');
      }

      const context = await this.validateInspectionContext(tx, tenantId, stockUnitId, dto);
      let inventoryBlockId: string | null = null;
      if (BLOCKING_INSPECTION_TYPES.has(dto.inspectionType)) {
        const block = await tx.inventoryBlock.create({
          data: {
            tenantId,
            stockUnitId,
            startDate: this.toDateOnly(new Date()),
            endDate: new Date('9999-12-31T00:00:00.000Z'),
            blockType: 'MAINTENANCE',
            reason: `${dto.inspectionType.toLowerCase()} inspection pending`,
            createdByUserId: actorUserId,
          },
        });
        inventoryBlockId = block.id;
      }
      const inspection = await tx.stockUnitInspection.create({
        data: {
          tenantId,
          stockUnitId,
          bookingItemId: dto.bookingItemId ?? context.bookingItemId,
          assignmentId: dto.assignmentId ?? null,
          serviceOrderId: dto.serviceOrderId ?? null,
          inventoryBlockId,
          inspectionType: dto.inspectionType,
          conditionBefore: unit.condition,
          notes: dto.notes?.trim() || null,
          inspectedByUserId: actorUserId,
          amendsInspectionId: dto.amendsInspectionId ?? null,
          createIdempotencyKey: dto.idempotencyKey ?? null,
        },
        include: this.inspectionInclude(),
      });

      if (
        dto.inspectionType === StockUnitInspectionType.RETURN &&
        unit.operationalState === StockUnitOperationalState.OUT_FOR_RENTAL
      ) {
        await this.lifecycle.transitionInTransaction(tx, {
          tenantId,
          stockUnitId,
          actorUserId,
          reason: 'Physical item returned and awaits inspection',
          targetOperationalState: StockUnitOperationalState.AWAITING_INSPECTION,
          assignmentId: dto.assignmentId,
          inspectionId: inspection.id,
          idempotencyKey: dto.idempotencyKey
            ? `inspection-return:${dto.idempotencyKey}`
            : undefined,
        });
      }

      return inspection;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async complete(
    tenantId: string,
    inspectionId: string,
    dto: CompleteStockUnitInspectionDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.stockUnitInspection.findFirst({
          where: { tenantId, completionIdempotencyKey: dto.idempotencyKey },
          include: this.inspectionInclude(),
        });
        if (existing) {
          if (existing.id !== inspectionId) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'The idempotency key belongs to another inspection completion',
            });
          }
          return existing;
        }
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM stock_unit_inspections
        WHERE tenant_id = ${tenantId} AND id = ${inspectionId}
        FOR UPDATE
      `);
      const inspection = await tx.stockUnitInspection.findFirst({
        where: { id: inspectionId, tenantId },
        include: { stockUnit: true, serviceOrder: true },
      });
      if (!inspection) throw new NotFoundException('Stock-unit inspection not found');
      if (inspection.status !== StockUnitInspectionStatus.DRAFT) {
        throw new ConflictException({
          code: 'INSPECTION_ALREADY_COMPLETED',
          message: 'Completed inspections are immutable; create an amendment instead',
        });
      }

      await this.validateInspectionChecks(
        tx,
        tenantId,
        inspection.stockUnit.variantSizeId,
        dto,
      );

      if (dto.checks?.length) {
        await tx.stockUnitInspectionCheck.createMany({
          data: dto.checks.map((check) => ({
            tenantId,
            inspectionId,
            setComponentDefinitionId: check.setComponentDefinitionId ?? null,
            labelSnapshot: check.label.trim(),
            expectedQuantity: check.expectedQuantity,
            observedQuantity: check.observedQuantity ?? null,
            result: check.result,
            notes: check.notes?.trim() || null,
          })),
        });
        await this.updateComponentStates(
          tx,
          tenantId,
          inspection.stockUnitId,
          dto,
        );
      }

      if (dto.issues?.length) {
        await tx.stockUnitIssue.createMany({
          data: dto.issues.map((issue) =>
            this.issueData(tenantId, inspection, issue, actorUserId),
          ),
        });
      }

      if (dto.media?.length) {
        await tx.inventoryMediaAttachment.createMany({
          data: dto.media.map((media) => ({
            tenantId,
            inspectionId,
            purpose: media.purpose,
            url: media.url,
            objectKey: media.objectKey?.trim() || null,
            mimeType: media.mimeType?.trim() || null,
            caption: media.caption?.trim() || null,
            uploadedByUserId: actorUserId,
            capturedAt: media.capturedAt ? new Date(media.capturedAt) : null,
          })),
        });
      }

      await tx.stockUnit.update({
        where: { id: inspection.stockUnitId },
        data: { condition: dto.conditionAfter },
      });
      await tx.stockUnitInspection.update({
        where: { id: inspectionId },
        data: {
          status: StockUnitInspectionStatus.COMPLETED,
          conditionAfter: dto.conditionAfter,
          decision: dto.decision,
          notes: dto.notes?.trim() || inspection.notes,
          customerLiabilityNote: dto.customerLiabilityNote?.trim() || null,
          completedAt: new Date(),
          completionIdempotencyKey: dto.idempotencyKey ?? null,
        },
      });

      if (inspection.amendsInspectionId) {
        await tx.stockUnitInspection.updateMany({
          where: {
            id: inspection.amendsInspectionId,
            tenantId,
            status: StockUnitInspectionStatus.COMPLETED,
          },
          data: { status: StockUnitInspectionStatus.SUPERSEDED },
        });
      }

      if (inspection.serviceOrder?.inventoryBlockId) {
        await tx.inventoryBlock.deleteMany({
          where: { id: inspection.serviceOrder.inventoryBlockId, tenantId },
        });
      }
      if (inspection.inventoryBlockId) {
        await tx.inventoryBlock.deleteMany({
          where: { id: inspection.inventoryBlockId, tenantId },
        });
      }

      const followupServiceOrderId = await this.createFollowupServiceOrder(
        tx,
        tenantId,
        inspection.stockUnitId,
        inspection.stockUnit.locationId,
        inspectionId,
        dto.decision,
        actorUserId,
      );
      const target = this.lifecycleTarget(dto.decision);
      await this.lifecycle.transitionInTransaction(tx, {
        tenantId,
        stockUnitId: inspection.stockUnitId,
        actorUserId,
        reason: dto.notes?.trim() || `Inspection decision: ${dto.decision}`,
        targetDisposition: target.disposition,
        targetOperationalState: target.operationalState,
        assignmentId: inspection.assignmentId ?? undefined,
        inspectionId,
        serviceOrderId: followupServiceOrderId ?? inspection.serviceOrderId ?? undefined,
        idempotencyKey: dto.idempotencyKey
          ? `inspection-lifecycle:${dto.idempotencyKey}`
          : undefined,
      });

      return tx.stockUnitInspection.findUniqueOrThrow({
        where: { id: inspectionId },
        include: this.inspectionInclude(),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resolveIssue(
    tenantId: string,
    issueId: string,
    dto: ResolveStockUnitIssueDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.stockUnitIssue.findFirst({
          where: { tenantId, resolutionIdempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (existing.id !== issueId) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'The idempotency key belongs to another issue resolution',
            });
          }
          return existing;
        }
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM stock_unit_issues
        WHERE tenant_id = ${tenantId} AND id = ${issueId}
        FOR UPDATE
      `);
      const issue = await tx.stockUnitIssue.findFirst({
        where: { id: issueId, tenantId },
      });
      if (!issue) throw new NotFoundException('Stock-unit issue not found');
      if (TERMINAL_ISSUE_STATUSES.has(issue.status)) {
        return issue;
      }
      const activeServices = await tx.inventoryServiceOrder.count({
        where: {
          tenantId,
          issueId,
          status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
      });
      if (activeServices > 0) {
        throw new ConflictException('Complete or cancel linked service work before resolving the issue');
      }
      return tx.stockUnitIssue.update({
        where: { id: issueId },
        data: {
          status: dto.waive ? StockUnitIssueStatus.WAIVED : StockUnitIssueStatus.RESOLVED,
          resolvedByUserId: actorUserId,
          resolvedAt: new Date(),
          resolutionNotes: dto.resolutionNotes.trim(),
          resolutionIdempotencyKey: dto.idempotencyKey ?? null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listForUnit(tenantId: string, stockUnitId: string) {
    const unit = await this.prisma.stockUnit.findFirst({
      where: { id: stockUnitId, tenantId, deletedAt: null },
      include: {
        location: true,
        variantSize: {
          include: {
            sizeInstance: true,
            variant: {
              include: {
                mainColor: true,
                product: { select: { id: true, name: true } },
              },
            },
            setComponentDefinitions: {
              where: { isActive: true },
              orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            },
          },
        },
        componentStates: {
          include: { setComponentDefinition: true },
          orderBy: { setComponentDefinition: { displayOrder: 'asc' } },
        },
        assignments: {
          where: { releasedAt: null },
          include: {
            reservation: {
              select: {
                id: true,
                bookingId: true,
                bookingItemId: true,
                blockedStartDate: true,
                blockedEndDate: true,
                status: true,
              },
            },
          },
          orderBy: { blockedStartDate: 'asc' },
        },
        blocks: {
          where: { endDate: { gte: this.toDateOnly(new Date()) } },
          orderBy: { startDate: 'asc' },
        },
      },
    });
    if (!unit) throw new NotFoundException('Stock unit not found');
    const [inspections, issues, lifecycleEvents] = await Promise.all([
      this.prisma.stockUnitInspection.findMany({
        where: { tenantId, stockUnitId },
        include: this.inspectionInclude(),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockUnitIssue.findMany({
        where: { tenantId, stockUnitId },
        include: {
          reportedBy: { select: { id: true, fullName: true } },
          resolvedBy: { select: { id: true, fullName: true } },
          serviceOrders: true,
          mediaAttachments: true,
          damageReport: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockUnitLifecycleEvent.findMany({
        where: { tenantId, stockUnitId },
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ]);
    return { stockUnit: unit, inspections, issues, lifecycleEvents };
  }

  private async validateInspectionContext(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stockUnitId: string,
    dto: CreateStockUnitInspectionDto,
  ): Promise<{ bookingItemId: string | null }> {
    let bookingItemId: string | null = null;
    if (dto.assignmentId) {
      const assignment = await tx.stockUnitAssignment.findFirst({
        where: { id: dto.assignmentId, tenantId, stockUnitId },
        select: { reservation: { select: { bookingItemId: true } } },
      });
      if (!assignment) throw new NotFoundException('Stock-unit assignment not found');
      bookingItemId = assignment.reservation.bookingItemId;
      if (dto.bookingItemId && dto.bookingItemId !== bookingItemId) {
        throw new BadRequestException('Booking item does not match the selected assignment');
      }
    }
    if (
      ASSIGNMENT_INSPECTION_TYPES.has(dto.inspectionType) &&
      !dto.assignmentId
    ) {
      throw new BadRequestException('Pre-rental and return inspections require an assignment');
    }
    if (dto.serviceOrderId) {
      const serviceOrder = await tx.inventoryServiceOrder.findFirst({
        where: { id: dto.serviceOrderId, tenantId, stockUnitId, status: 'COMPLETED' },
        select: { id: true },
      });
      if (!serviceOrder) throw new NotFoundException('Completed service order not found');
      const existingCompletionInspection = await tx.stockUnitInspection.findFirst({
        where: {
          tenantId,
          stockUnitId,
          serviceOrderId: dto.serviceOrderId,
          status: { in: [StockUnitInspectionStatus.DRAFT, StockUnitInspectionStatus.COMPLETED] },
        },
        select: { id: true },
      });
      if (existingCompletionInspection) {
        throw new ConflictException('This service order already has a completion inspection');
      }
    }
    if (
      dto.inspectionType === StockUnitInspectionType.SERVICE_COMPLETION &&
      !dto.serviceOrderId
    ) {
      throw new BadRequestException('Service-completion inspections require a service order');
    }
    if (dto.amendsInspectionId) {
      const amended = await tx.stockUnitInspection.findFirst({
        where: {
          id: dto.amendsInspectionId,
          tenantId,
          stockUnitId,
          status: StockUnitInspectionStatus.COMPLETED,
        },
        select: { id: true },
      });
      if (!amended) throw new NotFoundException('Completed inspection to amend was not found');
    }
    return { bookingItemId };
  }

  private async validateInspectionChecks(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
    dto: CompleteStockUnitInspectionDto,
  ): Promise<void> {
    const requiredDefinitions = await tx.skuSetComponentDefinition.findMany({
      where: { tenantId, variantSizeId, isActive: true },
      select: { id: true, name: true },
    });
    const providedDefinitionIds = new Set(
      dto.checks?.flatMap((check) =>
        check.setComponentDefinitionId ? [check.setComponentDefinitionId] : [],
      ) ?? [],
    );
    const missing = requiredDefinitions.filter(
      (definition) => !providedDefinitionIds.has(definition.id),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Inspection is missing set checks: ${missing.map((item) => item.name).join(', ')}`,
      );
    }
    const knownIds = new Set(requiredDefinitions.map((definition) => definition.id));
    const invalid = [...providedDefinitionIds].filter((id) => !knownIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException('One or more set-component checks do not belong to this SKU');
    }
  }

  private async updateComponentStates(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stockUnitId: string,
    dto: CompleteStockUnitInspectionDto,
  ): Promise<void> {
    for (const check of dto.checks ?? []) {
      if (!check.setComponentDefinitionId) continue;
      const completeQuantity = (check.observedQuantity ?? check.expectedQuantity) >= check.expectedQuantity;
      const presence =
        check.result === 'PASS' && completeQuantity
          ? 'PRESENT'
          : completeQuantity
            ? 'DAMAGED'
            : 'MISSING';
      await tx.stockUnitComponentState.upsert({
        where: {
          stockUnitId_setComponentDefinitionId: {
            stockUnitId,
            setComponentDefinitionId: check.setComponentDefinitionId,
          },
        },
        create: {
          tenantId,
          stockUnitId,
          setComponentDefinitionId: check.setComponentDefinitionId,
          presence,
          presentQuantity: check.observedQuantity ?? check.expectedQuantity,
          condition: dto.conditionAfter,
          notes: check.notes?.trim() || null,
        },
        update: {
          presence,
          presentQuantity: check.observedQuantity ?? check.expectedQuantity,
          condition: dto.conditionAfter,
          notes: check.notes?.trim() || null,
        },
      });
    }
  }

  private issueData(
    tenantId: string,
    inspection: {
      id: string;
      stockUnitId: string;
      bookingItemId: string | null;
      assignmentId: string | null;
    },
    issue: InspectionIssueInputDto,
    actorUserId: string,
  ): Prisma.StockUnitIssueCreateManyInput {
    return {
      tenantId,
      stockUnitId: inspection.stockUnitId,
      inspectionId: inspection.id,
      bookingItemId: inspection.bookingItemId,
      assignmentId: inspection.assignmentId,
      issueType: issue.issueType.trim(),
      severity: issue.severity,
      responsibility: issue.responsibility ?? 'UNKNOWN',
      description: issue.description.trim(),
      isAvailabilityBlocking:
        issue.isAvailabilityBlocking ??
        DEFAULT_BLOCKING_ISSUE_SEVERITIES.has(issue.severity),
      estimatedCost: issue.estimatedCost ?? null,
      customerCharge: issue.customerCharge ?? null,
      reportedByUserId: actorUserId,
    };
  }

  private async createFollowupServiceOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stockUnitId: string,
    serviceLocationId: string,
    inspectionId: string,
    decision: StockUnitInspectionDecision,
    actorUserId: string,
  ): Promise<string | null> {
    const serviceType = this.serviceTypeForDecision(decision);
    if (!serviceType) return null;
    const block = await tx.inventoryBlock.create({
      data: {
        tenantId,
        stockUnitId,
        locationId: serviceLocationId,
        startDate: this.toDateOnly(new Date()),
        endDate: new Date('9999-12-31T00:00:00.000Z'),
        blockType: 'MAINTENANCE',
        reason: `Required by inspection ${inspectionId}`,
        createdByUserId: actorUserId,
      },
    });
    const order = await tx.inventoryServiceOrder.create({
      data: {
        tenantId,
        stockUnitId,
        serviceLocationId,
        sourceInspectionId: inspectionId,
        inventoryBlockId: block.id,
        serviceType,
        status: 'IN_PROGRESS',
        isAvailabilityBlocking: true,
        requestedByUserId: actorUserId,
        startedAt: new Date(),
        notes: `Created from inspection decision ${decision}`,
      },
    });
    return order.id;
  }

  private lifecycleTarget(decision: StockUnitInspectionDecision): {
    disposition: StockUnitDisposition;
    operationalState: StockUnitOperationalState;
  } {
    const targets: Record<
      StockUnitInspectionDecision,
      { disposition: StockUnitDisposition; operationalState: StockUnitOperationalState }
    > = {
      AVAILABLE: {
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.AVAILABLE,
      },
      CLEANING: {
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.CLEANING,
      },
      WASHING: {
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.WASHING,
      },
      REPAIR: {
        disposition: StockUnitDisposition.ACTIVE,
        operationalState: StockUnitOperationalState.REPAIRING,
      },
      QUARANTINE: {
        disposition: StockUnitDisposition.QUARANTINED,
        operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      },
      LOST: {
        disposition: StockUnitDisposition.LOST,
        operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      },
      RETIRE: {
        disposition: StockUnitDisposition.RETIRED,
        operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      },
    };
    return targets[decision];
  }

  private serviceTypeForDecision(
    decision: StockUnitInspectionDecision,
  ): InventoryServiceOrderType | null {
    const types: Partial<Record<StockUnitInspectionDecision, InventoryServiceOrderType>> = {
      CLEANING: InventoryServiceOrderType.CLEANING,
      WASHING: InventoryServiceOrderType.WASHING,
      REPAIR: InventoryServiceOrderType.REPAIR,
    };
    return types[decision] ?? null;
  }

  private inspectionInclude() {
    return {
      stockUnit: { select: { id: true, assetCode: true, condition: true, operationalState: true } },
      bookingItem: { select: { id: true, bookingId: true, productName: true } },
      assignment: { select: { id: true, reservationId: true, assignedAt: true } },
      serviceOrder: { select: { id: true, serviceType: true, status: true } },
      inspectedBy: { select: { id: true, fullName: true } },
      checks: { orderBy: { createdAt: 'asc' as const } },
      issues: { orderBy: { createdAt: 'asc' as const } },
      mediaAttachments: { orderBy: { createdAt: 'asc' as const } },
    } satisfies Prisma.StockUnitInspectionInclude;
  }

  private toDateOnly(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
