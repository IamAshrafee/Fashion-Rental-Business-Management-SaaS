import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CompositionSkuResolution, Prisma, ProductCompositionRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompositionRuleDto, UpdateCompositionRuleDto } from './dto/fulfillment.dto';

const MAX_COMPOSITION_DEPTH = 5;

@Injectable()
export class ProductCompositionService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, parentProductId: string, activeOnly = false) {
    return this.prisma.productCompositionRule.findMany({
      where: { tenantId, parentProductId, ...(activeOnly ? { isActive: true } : {}) },
      include: this.ruleInclude(),
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listPublic(tenantId: string, parentProductId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: parentProductId, tenantId, status: 'published', deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.productCompositionRule.findMany({
      where: {
        tenantId,
        parentProductId,
        isActive: true,
        componentProduct: { status: 'published', deletedAt: null },
      },
      include: {
        ...this.ruleInclude(),
        alternatives: {
          where: {
            isActive: true,
            product: { status: 'published', deletedAt: null },
          },
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variantSize: { include: { sizeInstance: true, variant: { include: { mainColor: true } } } },
          },
          orderBy: [{ priority: 'asc' as const }, { createdAt: 'asc' as const }],
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(
    tenantId: string,
    parentProductId: string,
    dto: CreateCompositionRuleDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.validateRule(tx, tenantId, parentProductId, dto);
      for (const componentId of this.componentProductIds(dto)) {
        await this.assertAcyclic(tx, tenantId, parentProductId, componentId, undefined);
      }
      try {
        return await tx.productCompositionRule.create({
          data: {
            tenantId,
            parentProductId,
            componentProductId: dto.componentProductId,
            fixedVariantSizeId: dto.fixedVariantSizeId ?? null,
            role: dto.role,
            name: dto.name.trim(),
            selectionGroupKey: dto.selectionGroupKey?.trim() || null,
            quantity: dto.quantity,
            skuResolution: dto.skuResolution,
            substitutionPolicy: dto.substitutionPolicy,
            pricingBehavior: dto.pricingBehavior,
            priceAdjustment: dto.priceAdjustment,
            allocationWeight: dto.allocationWeight,
            isDefaultSelected: dto.isDefaultSelected,
            customerApprovalRequired: dto.customerApprovalRequired,
            compatibilityRules: this.json(dto.compatibilityRules),
            displayOrder: dto.displayOrder,
            createdByUserId: actorUserId ?? null,
            alternatives: {
              create: (dto.alternatives ?? []).map((alternative) => ({
                tenantId,
                productId: alternative.productId,
                variantSizeId: alternative.variantSizeId ?? null,
                priority: alternative.priority,
                compatibilityRule: this.json(alternative.compatibilityRule),
                priceAdjustment: alternative.priceAdjustment,
              })),
            },
          },
          include: this.ruleInclude(),
        });
      } catch (error) {
        this.rethrowUnique(error);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async update(
    tenantId: string,
    ruleId: string,
    dto: UpdateCompositionRuleDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.productCompositionRule.findFirst({ where: { id: ruleId, tenantId } });
      if (!current) throw new NotFoundException('Composition rule not found');
      await this.validateRule(tx, tenantId, current.parentProductId, dto);
      for (const componentId of this.componentProductIds(dto)) {
        await this.assertAcyclic(tx, tenantId, current.parentProductId, componentId, ruleId);
      }
      await tx.productCompositionAlternative.deleteMany({ where: { tenantId, ruleId } });
      try {
        return await tx.productCompositionRule.update({
          where: { id: ruleId },
          data: {
            componentProductId: dto.componentProductId,
            fixedVariantSizeId: dto.fixedVariantSizeId ?? null,
            role: dto.role,
            name: dto.name.trim(),
            selectionGroupKey: dto.selectionGroupKey?.trim() || null,
            quantity: dto.quantity,
            skuResolution: dto.skuResolution,
            substitutionPolicy: dto.substitutionPolicy,
            pricingBehavior: dto.pricingBehavior,
            priceAdjustment: dto.priceAdjustment,
            allocationWeight: dto.allocationWeight,
            isDefaultSelected: dto.isDefaultSelected,
            customerApprovalRequired: dto.customerApprovalRequired,
            compatibilityRules: this.json(dto.compatibilityRules),
            displayOrder: dto.displayOrder,
            configurationVersion: { increment: 1 },
            alternatives: {
              create: (dto.alternatives ?? []).map((alternative) => ({
                tenantId,
                productId: alternative.productId,
                variantSizeId: alternative.variantSizeId ?? null,
                priority: alternative.priority,
                compatibilityRule: this.json(alternative.compatibilityRule),
                priceAdjustment: alternative.priceAdjustment,
              })),
            },
          },
          include: this.ruleInclude(),
        });
      } catch (error) {
        this.rethrowUnique(error);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async deactivate(tenantId: string, ruleId: string) {
    const rule = await this.prisma.productCompositionRule.findFirst({
      where: { id: ruleId, tenantId, isActive: true },
      select: { id: true, parentProduct: { select: { status: true } } },
    });
    if (!rule) throw new NotFoundException('Active composition rule not found');
    if (rule.parentProduct.status === 'published') {
      throw new ConflictException({
        code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED',
        section: 'composition',
        message: 'Unpublish this product before changing its bundle composition.',
      });
    }
    return this.prisma.productCompositionRule.update({
      where: { id: ruleId },
      data: { isActive: false, configurationVersion: { increment: 1 } },
    });
  }

  private async validateRule(
    tx: Prisma.TransactionClient,
    tenantId: string,
    parentProductId: string,
    dto: CreateCompositionRuleDto,
  ) {
    if (!dto.name.trim()) throw new BadRequestException('Composition rule name is required');
    if (dto.role === ProductCompositionRole.MAIN) {
      throw new BadRequestException('The main product requirement is created automatically');
    }
    if (!dto.componentProductId) {
      throw new BadRequestException('A component product is required');
    }
    if (dto.componentProductId === parentProductId) {
      throw new ConflictException('A product cannot contain itself');
    }
    const products = await tx.product.findMany({
      where: { tenantId, id: { in: [parentProductId, dto.componentProductId] }, deletedAt: null },
      select: { id: true, status: true },
    });
    if (products.length !== 2) throw new NotFoundException('Parent or component product not found');
    if (products.find((product) => product.id === parentProductId)?.status === 'published') {
      throw new ConflictException({
        code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED',
        section: 'composition',
        message: 'Unpublish this product before changing its bundle composition.',
      });
    }
    if (dto.skuResolution === CompositionSkuResolution.FIXED && !dto.fixedVariantSizeId) {
      throw new BadRequestException('Fixed composition rules require a variant-size SKU');
    }
    if (dto.skuResolution !== CompositionSkuResolution.FIXED && dto.fixedVariantSizeId) {
      throw new BadRequestException('A fixed SKU can only be used with fixed SKU resolution');
    }
    if (
      dto.pricingBehavior === 'OPTIONAL_PRICE' &&
      dto.role !== ProductCompositionRole.OPTIONAL_ADDON
    ) {
      throw new BadRequestException('Optional pricing can only be used for optional add-ons');
    }
    if (dto.pricingBehavior === 'INCLUDED' && dto.priceAdjustment !== 0) {
      throw new BadRequestException('Included components cannot have a price adjustment');
    }
    if (dto.pricingBehavior !== 'INCLUDED' && dto.priceAdjustment <= 0) {
      throw new BadRequestException('Priced components require a positive price adjustment');
    }
    if (
      dto.skuResolution === CompositionSkuResolution.CUSTOMER_SELECTED &&
      dto.isDefaultSelected &&
      !(dto.alternatives ?? []).some((alternative) => alternative.variantSizeId)
    ) {
      throw new BadRequestException(
        'A customer-selected default requires an alternative with a default SKU',
      );
    }
    this.validateCompatibilityNotes(dto.compatibilityRules, 'compatibilityRules');
    if (dto.fixedVariantSizeId) {
      await this.assertSkuBelongsToProduct(tx, tenantId, dto.fixedVariantSizeId, dto.componentProductId);
    }
    for (const alternative of dto.alternatives ?? []) {
      if (alternative.productId === dto.componentProductId && !alternative.variantSizeId) {
        throw new BadRequestException('An alternative must differ from the primary component');
      }
      this.validateCompatibilityNotes(alternative.compatibilityRule, 'alternative.compatibilityRule');
      const alternativeProduct = await tx.product.findFirst({
        where: { id: alternative.productId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!alternativeProduct) throw new NotFoundException('Alternative product not found');
      if (alternative.variantSizeId) {
        await this.assertSkuBelongsToProduct(tx, tenantId, alternative.variantSizeId, alternative.productId);
      }
    }
    const identities = (dto.alternatives ?? []).map(
      (alternative) => `${alternative.productId}:${alternative.variantSizeId ?? '*'}`,
    );
    if (new Set(identities).size !== identities.length) {
      throw new BadRequestException('Duplicate composition alternatives are not allowed');
    }
  }

  private validateCompatibilityNotes(
    value: Record<string, unknown> | undefined,
    field: string,
  ): void {
    if (!value) return;
    const keys = Object.keys(value);
    if (keys.some((key) => key !== 'notes')) {
      throw new BadRequestException(`${field} contains unsupported compatibility fields`);
    }
    if (
      value.notes !== undefined &&
      (typeof value.notes !== 'string' || value.notes.trim().length > 1_000)
    ) {
      throw new BadRequestException(`${field}.notes must be text of 1,000 characters or fewer`);
    }
  }

  private async assertSkuBelongsToProduct(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantSizeId: string,
    productId: string,
  ) {
    const sku = await tx.variantSize.findFirst({
      where: { id: variantSizeId, tenantId, variant: { productId } },
      select: { id: true },
    });
    if (!sku) throw new BadRequestException('Selected SKU does not belong to the selected product');
  }

  private async assertAcyclic(
    tx: Prisma.TransactionClient,
    tenantId: string,
    parentProductId: string,
    componentProductId: string,
    excludedRuleId?: string,
  ) {
    const rules = await tx.productCompositionRule.findMany({
      where: {
        tenantId,
        isActive: true,
        componentProductId: { not: null },
        ...(excludedRuleId ? { id: { not: excludedRuleId } } : {}),
      },
      select: {
        parentProductId: true,
        componentProductId: true,
        alternatives: { where: { isActive: true }, select: { productId: true } },
      },
    });
    const graph = new Map<string, string[]>();
    for (const rule of rules) {
      if (!rule.componentProductId) continue;
      graph.set(rule.parentProductId, [
        ...(graph.get(rule.parentProductId) ?? []),
        rule.componentProductId,
        ...rule.alternatives.map((alternative) => alternative.productId),
      ]);
    }
    graph.set(parentProductId, [...(graph.get(parentProductId) ?? []), componentProductId]);

    const visit = (productId: string, path: Set<string>, depth: number): void => {
      if (depth > MAX_COMPOSITION_DEPTH) {
        throw new ConflictException(`Composition nesting cannot exceed ${MAX_COMPOSITION_DEPTH} levels`);
      }
      if (path.has(productId)) throw new ConflictException('Product composition would create a cycle');
      const nextPath = new Set(path).add(productId);
      for (const childId of graph.get(productId) ?? []) visit(childId, nextPath, depth + 1);
    };
    visit(parentProductId, new Set(), 0);
  }

  private componentProductIds(dto: CreateCompositionRuleDto): string[] {
    return [...new Set([
      ...(dto.componentProductId ? [dto.componentProductId] : []),
      ...(dto.alternatives ?? []).map((alternative) => alternative.productId),
    ])];
  }

  private ruleInclude() {
    return {
      componentProduct: { select: { id: true, name: true, slug: true, status: true } },
      fixedVariantSize: {
        include: {
          sizeInstance: true,
          variant: { include: { mainColor: true } },
        },
      },
      alternatives: {
        where: { isActive: true },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          variantSize: { include: { sizeInstance: true, variant: { include: { mainColor: true } } } },
        },
        orderBy: [{ priority: 'asc' as const }, { createdAt: 'asc' as const }],
      },
    } satisfies Prisma.ProductCompositionRuleInclude;
  }

  private json(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    return value ? (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue) : undefined;
  }

  private rethrowUnique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A composition rule with this name or alternative already exists');
    }
    throw error;
  }
}
