import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AvailabilityPolicy,
  AvailabilityPolicyScope,
  Prisma,
  StockConditionGrade,
  StockUnitOperationalState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertAvailabilityPolicyDto } from './dto/inventory-foundation.dto';

const SYSTEM_DEFAULTS = {
  preparationBufferMinutes: 0,
  deliveryBufferMinutes: 0,
  returnBufferMinutes: 0,
  inspectionBufferMinutes: 0,
  cleaningBufferMinutes: 0,
  minimumNoticeMinutes: 0,
  maximumAdvanceDays: 365,
  pendingHoldMinutes: 30,
  allowShortage: false,
  shortageLimit: 0,
  requireSingleLocationForBundle: true,
  allowCrossLocationTransfers: false,
  transferLeadTimeMinutes: 0,
  eligibleConditionGrades: [
    StockConditionGrade.NEW,
    StockConditionGrade.EXCELLENT,
    StockConditionGrade.GOOD,
    StockConditionGrade.FAIR,
  ],
  eligibleOperationalStates: [StockUnitOperationalState.AVAILABLE],
} as const;

export interface EffectiveAvailabilityPolicy {
  preparationBufferMinutes: number;
  deliveryBufferMinutes: number;
  returnBufferMinutes: number;
  inspectionBufferMinutes: number;
  cleaningBufferMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  pendingHoldMinutes: number;
  allowShortage: boolean;
  shortageLimit: number;
  requireSingleLocationForBundle: boolean;
  allowCrossLocationTransfers: boolean;
  transferLeadTimeMinutes: number;
  eligibleConditionGrades: StockConditionGrade[];
  eligibleOperationalStates: StockUnitOperationalState[];
  sources: Array<{ id: string; scope: AvailabilityPolicyScope; version: number }>;
}

@Injectable()
export class AvailabilityPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.availabilityPolicy.findMany({
      where: { tenantId },
      orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
      include: {
        location: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, name: true } },
        variantSize: {
          select: {
            id: true,
            sizeInstance: { select: { displayLabel: true } },
            variant: { select: { variantName: true, product: { select: { name: true } } } },
          },
        },
      },
    });
  }

  async upsert(tenantId: string, dto: UpsertAvailabilityPolicyDto) {
    const scopeKey = this.scopeKey(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.validateScopeTargets(tx, tenantId, dto);
      const data = this.policyData(dto);
      return tx.availabilityPolicy.upsert({
        where: { tenantId_scopeKey: { tenantId, scopeKey } },
        create: {
          tenantId,
          scope: dto.scope,
          scopeKey,
          locationId: dto.locationId ?? null,
          productId: dto.productId ?? null,
          variantSizeId: dto.variantSizeId ?? null,
          ...data,
        },
        update: {
          ...data,
          isActive: true,
          version: { increment: 1 },
        },
      });
    });
  }

  async deactivate(tenantId: string, policyId: string) {
    const policy = await this.prisma.availabilityPolicy.findFirst({
      where: { id: policyId, tenantId },
    });
    if (!policy) throw new NotFoundException('Availability policy not found');
    return this.prisma.availabilityPolicy.update({
      where: { id: policyId },
      data: { isActive: false, version: { increment: 1 } },
    });
  }

  async resolve(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    productId: string,
    variantSizeId: string,
    locationId: string,
  ): Promise<EffectiveAvailabilityPolicy> {
    const policies = await db.availabilityPolicy.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { scope: AvailabilityPolicyScope.TENANT, scopeKey: 'TENANT' },
          { scope: AvailabilityPolicyScope.PRODUCT, productId },
          { scope: AvailabilityPolicyScope.LOCATION, locationId },
          { scope: AvailabilityPolicyScope.SKU, variantSizeId },
        ],
      },
    });
    const priority: Record<AvailabilityPolicyScope, number> = {
      TENANT: 0,
      PRODUCT: 1,
      LOCATION: 2,
      SKU: 3,
    };
    policies.sort((left, right) => priority[left.scope] - priority[right.scope]);

    const resolved: EffectiveAvailabilityPolicy = {
      ...SYSTEM_DEFAULTS,
      eligibleConditionGrades: [...SYSTEM_DEFAULTS.eligibleConditionGrades],
      eligibleOperationalStates: [...SYSTEM_DEFAULTS.eligibleOperationalStates],
      sources: [],
    };
    for (const policy of policies) {
      this.applyPolicy(resolved, policy);
      resolved.sources.push({ id: policy.id, scope: policy.scope, version: policy.version });
    }
    return resolved;
  }

  snapshot(policy: EffectiveAvailabilityPolicy): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(policy)) as Prisma.InputJsonValue;
  }

  calculateBlockedRange(
    rentalStart: Date,
    rentalEnd: Date,
    policy: EffectiveAvailabilityPolicy,
  ) {
    const beforeMinutes = policy.preparationBufferMinutes + policy.deliveryBufferMinutes;
    const afterMinutes =
      policy.returnBufferMinutes +
      policy.inspectionBufferMinutes +
      policy.cleaningBufferMinutes;
    return {
      blockedStart: this.addDays(rentalStart, -Math.ceil(beforeMinutes / 1_440)),
      blockedEnd: this.addDays(rentalEnd, Math.ceil(afterMinutes / 1_440)),
    };
  }

  private scopeKey(dto: UpsertAvailabilityPolicyDto) {
    const provided = [dto.locationId, dto.productId, dto.variantSizeId].filter(Boolean);
    if (dto.scope === AvailabilityPolicyScope.TENANT) {
      if (provided.length) throw new BadRequestException('Tenant policy cannot target another scope');
      return 'TENANT';
    }
    if (dto.scope === AvailabilityPolicyScope.LOCATION && dto.locationId && provided.length === 1) {
      return `LOCATION:${dto.locationId}`;
    }
    if (dto.scope === AvailabilityPolicyScope.PRODUCT && dto.productId && provided.length === 1) {
      return `PRODUCT:${dto.productId}`;
    }
    if (dto.scope === AvailabilityPolicyScope.SKU && dto.variantSizeId && provided.length === 1) {
      return `SKU:${dto.variantSizeId}`;
    }
    throw new BadRequestException('Policy target must exactly match its scope');
  }

  private async validateScopeTargets(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dto: UpsertAvailabilityPolicyDto,
  ) {
    if (dto.locationId) {
      const exists = await tx.inventoryLocation.count({ where: { id: dto.locationId, tenantId } });
      if (!exists) throw new NotFoundException('Inventory location not found');
    }
    if (dto.productId) {
      const exists = await tx.product.count({
        where: { id: dto.productId, tenantId, deletedAt: null },
      });
      if (!exists) throw new NotFoundException('Product not found');
    }
    if (dto.variantSizeId) {
      const exists = await tx.variantSize.count({ where: { id: dto.variantSizeId, tenantId } });
      if (!exists) throw new NotFoundException('Variant-size inventory not found');
    }
  }

  private policyData(dto: UpsertAvailabilityPolicyDto) {
    return {
      preparationBufferMinutes: dto.preparationBufferMinutes ?? null,
      deliveryBufferMinutes: dto.deliveryBufferMinutes ?? null,
      returnBufferMinutes: dto.returnBufferMinutes ?? null,
      inspectionBufferMinutes: dto.inspectionBufferMinutes ?? null,
      cleaningBufferMinutes: dto.cleaningBufferMinutes ?? null,
      minimumNoticeMinutes: dto.minimumNoticeMinutes ?? null,
      maximumAdvanceDays: dto.maximumAdvanceDays ?? null,
      pendingHoldMinutes: dto.pendingHoldMinutes ?? null,
      allowShortage: dto.allowShortage ?? null,
      shortageLimit: dto.shortageLimit ?? null,
      requireSingleLocationForBundle: dto.requireSingleLocationForBundle ?? null,
      allowCrossLocationTransfers: dto.allowCrossLocationTransfers ?? null,
      transferLeadTimeMinutes: dto.transferLeadTimeMinutes ?? null,
    };
  }

  private applyPolicy(target: EffectiveAvailabilityPolicy, policy: AvailabilityPolicy) {
    const scalarKeys = [
      'preparationBufferMinutes',
      'deliveryBufferMinutes',
      'returnBufferMinutes',
      'inspectionBufferMinutes',
      'cleaningBufferMinutes',
      'minimumNoticeMinutes',
      'maximumAdvanceDays',
      'pendingHoldMinutes',
      'allowShortage',
      'shortageLimit',
      'requireSingleLocationForBundle',
      'allowCrossLocationTransfers',
      'transferLeadTimeMinutes',
    ] as const;
    for (const key of scalarKeys) {
      const value = policy[key];
      if (value !== null) Object.assign(target, { [key]: value });
    }
    const conditionGrades = this.enumArray(policy.eligibleConditionGrades, StockConditionGrade);
    if (conditionGrades) target.eligibleConditionGrades = conditionGrades;
    const operationalStates = this.enumArray(
      policy.eligibleOperationalStates,
      StockUnitOperationalState,
    );
    if (operationalStates) target.eligibleOperationalStates = operationalStates;
  }

  private enumArray<T extends string>(value: Prisma.JsonValue | null, values: Record<string, T>) {
    if (!Array.isArray(value)) return null;
    const allowed = new Set(Object.values(values));
    return value.filter((item): item is T => typeof item === 'string' && allowed.has(item as T));
  }

  private addDays(value: Date, days: number) {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
