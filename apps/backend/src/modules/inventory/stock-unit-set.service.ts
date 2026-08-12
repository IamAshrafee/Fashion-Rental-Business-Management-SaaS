import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockUnitDisposition, StockUnitOperationalState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSkuSetComponentDto,
  UpdateStockUnitComponentStateDto,
} from './dto/inventory-operations.dto';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';

@Injectable()
export class StockUnitSetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: StockUnitLifecycleService,
  ) {}

  async createDefinition(
    tenantId: string,
    variantSizeId: string,
    dto: CreateSkuSetComponentDto,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const sku = await tx.variantSize.findFirst({
          where: { id: variantSizeId, tenantId },
          select: { id: true },
        });
        if (!sku) throw new NotFoundException('Variant-size inventory was not found');

        const definition = await tx.skuSetComponentDefinition.create({
          data: {
            tenantId,
            variantSizeId,
            name: dto.name.trim(),
            requiredQuantity: dto.requiredQuantity,
            inspectionGuidance: dto.inspectionGuidance?.trim() || null,
            absenceBlocksRental: dto.absenceBlocksRental,
            displayOrder: dto.displayOrder,
            createdByUserId: actorUserId,
          },
        });
        const units = await tx.stockUnit.findMany({
          where: { tenantId, variantSizeId, deletedAt: null },
          select: { id: true, condition: true },
        });
        if (units.length > 0) {
          await tx.stockUnitComponentState.createMany({
            data: units.map((unit) => ({
              tenantId,
              stockUnitId: unit.id,
              setComponentDefinitionId: definition.id,
              presence: 'PRESENT',
              presentQuantity: dto.requiredQuantity,
              condition: unit.condition,
              notes: 'Initialized when the SKU set checklist was configured',
            })),
          });
        }
        return definition;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A set component with this name already exists for the SKU');
      }
      throw error;
    }
  }

  async deactivateDefinition(tenantId: string, definitionId: string) {
    const definition = await this.prisma.skuSetComponentDefinition.findFirst({
      where: { id: definitionId, tenantId, isActive: true },
    });
    if (!definition) throw new NotFoundException('Active set-component definition not found');
    return this.prisma.skuSetComponentDefinition.update({
      where: { id: definitionId },
      data: { isActive: false },
    });
  }

  async listDefinitions(tenantId: string, variantSizeId: string) {
    const sku = await this.prisma.variantSize.findFirst({
      where: { id: variantSizeId, tenantId },
      select: { id: true },
    });
    if (!sku) throw new NotFoundException('Variant-size inventory was not found');
    return this.prisma.skuSetComponentDefinition.findMany({
      where: { tenantId, variantSizeId, isActive: true },
      include: {
        unitStates: {
          include: { stockUnit: { select: { id: true, assetCode: true } } },
          orderBy: { stockUnit: { assetCode: 'asc' } },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async updateUnitState(
    tenantId: string,
    stockUnitId: string,
    definitionId: string,
    dto: UpdateStockUnitComponentStateDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.skuSetComponentDefinition.findFirst({
        where: {
          id: definitionId,
          tenantId,
          isActive: true,
          variantSize: { stockUnits: { some: { id: stockUnitId, tenantId, deletedAt: null } } },
        },
      });
      if (!definition) throw new NotFoundException('Set component or stock unit was not found');
      const state = await tx.stockUnitComponentState.upsert({
        where: {
          stockUnitId_setComponentDefinitionId: {
            stockUnitId,
            setComponentDefinitionId: definitionId,
          },
        },
        create: {
          tenantId,
          stockUnitId,
          setComponentDefinitionId: definitionId,
          presence: dto.presence,
          presentQuantity: dto.presentQuantity,
          condition: dto.condition ?? null,
          notes: dto.notes?.trim() || null,
        },
        update: {
          presence: dto.presence,
          presentQuantity: dto.presentQuantity,
          condition: dto.condition ?? null,
          notes: dto.notes?.trim() || null,
        },
      });

      const incomplete =
        definition.absenceBlocksRental &&
        (dto.presence === 'MISSING' ||
          dto.presence === 'DAMAGED' ||
          dto.presentQuantity < definition.requiredQuantity);
      if (incomplete) {
        await this.lifecycle.transitionInTransaction(tx, {
          tenantId,
          stockUnitId,
          actorUserId,
          reason: `Required set component is incomplete: ${definition.name}`,
          targetDisposition: StockUnitDisposition.QUARANTINED,
          targetOperationalState: StockUnitOperationalState.AWAITING_INSPECTION,
          metadata: {
            setComponentDefinitionId: definitionId,
            presence: dto.presence,
            presentQuantity: dto.presentQuantity,
          },
        });
      }
      return state;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
