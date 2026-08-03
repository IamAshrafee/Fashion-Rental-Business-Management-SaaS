import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInventoryLocationDto,
  UpdateInventoryLocationDto,
} from './dto/inventory-foundation.dto';

@Injectable()
export class InventoryLocationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, includeInactive = false) {
    return this.prisma.inventoryLocation.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { stockUnits: true, pools: true } },
      },
    });
  }

  async create(tenantId: string, dto: CreateInventoryLocationDto, actorUserId?: string) {
    this.assertTimezone(dto.timezone ?? 'Asia/Dhaka');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locationCount = await tx.inventoryLocation.count({ where: { tenantId } });
        const makeDefault = locationCount === 0 || dto.isDefault === true;
        if (makeDefault) {
          await tx.inventoryLocation.updateMany({
            where: { tenantId, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.inventoryLocation.create({
          data: {
            tenantId,
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
            locationType: dto.locationType,
            timezone: dto.timezone ?? 'Asia/Dhaka',
            addressLine1: this.clean(dto.addressLine1),
            addressLine2: this.clean(dto.addressLine2),
            city: this.clean(dto.city),
            state: this.clean(dto.state),
            postalCode: this.clean(dto.postalCode),
            country: dto.country?.trim().toUpperCase() ?? 'BD',
            contactName: this.clean(dto.contactName),
            contactPhone: this.clean(dto.contactPhone),
            contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
            canStoreInventory: dto.canStoreInventory ?? true,
            canFulfillRentals: dto.canFulfillRentals ?? true,
            canCustomerPickup: dto.canCustomerPickup ?? false,
            canAcceptReturns: dto.canAcceptReturns ?? true,
            canClean: dto.canClean ?? false,
            canRepair: dto.canRepair ?? false,
            canTransfer: dto.canTransfer ?? true,
            isDefault: makeDefault,
            createdByUserId: actorUserId ?? null,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(tenantId: string, locationId: string, dto: UpdateInventoryLocationDto) {
    if (dto.timezone !== undefined) this.assertTimezone(dto.timezone);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getById(tx, tenantId, locationId);
      if (dto.isActive === false && current.isActive) {
        if (current.isDefault) {
          throw new ConflictException('Choose another default location before deactivating this one');
        }
        await this.assertCanDeactivate(tx, tenantId, locationId);
      }
      return tx.inventoryLocation.update({
        where: { id: locationId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.locationType !== undefined ? { locationType: dto.locationType } : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
          ...(dto.addressLine1 !== undefined ? { addressLine1: this.clean(dto.addressLine1) } : {}),
          ...(dto.addressLine2 !== undefined ? { addressLine2: this.clean(dto.addressLine2) } : {}),
          ...(dto.city !== undefined ? { city: this.clean(dto.city) } : {}),
          ...(dto.state !== undefined ? { state: this.clean(dto.state) } : {}),
          ...(dto.postalCode !== undefined ? { postalCode: this.clean(dto.postalCode) } : {}),
          ...(dto.country !== undefined ? { country: dto.country.trim().toUpperCase() } : {}),
          ...(dto.contactName !== undefined ? { contactName: this.clean(dto.contactName) } : {}),
          ...(dto.contactPhone !== undefined ? { contactPhone: this.clean(dto.contactPhone) } : {}),
          ...(dto.contactEmail !== undefined
            ? { contactEmail: dto.contactEmail.trim().toLowerCase() || null }
            : {}),
          ...(dto.canStoreInventory !== undefined ? { canStoreInventory: dto.canStoreInventory } : {}),
          ...(dto.canFulfillRentals !== undefined ? { canFulfillRentals: dto.canFulfillRentals } : {}),
          ...(dto.canCustomerPickup !== undefined ? { canCustomerPickup: dto.canCustomerPickup } : {}),
          ...(dto.canAcceptReturns !== undefined ? { canAcceptReturns: dto.canAcceptReturns } : {}),
          ...(dto.canClean !== undefined ? { canClean: dto.canClean } : {}),
          ...(dto.canRepair !== undefined ? { canRepair: dto.canRepair } : {}),
          ...(dto.canTransfer !== undefined ? { canTransfer: dto.canTransfer } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async setDefault(tenantId: string, locationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const location = await this.getById(tx, tenantId, locationId);
      if (!location.isActive || !location.canStoreInventory || !location.canFulfillRentals) {
        throw new ConflictException(
          'The default location must be active and able to store and fulfill inventory',
        );
      }
      await tx.inventoryLocation.updateMany({
        where: { tenantId, isDefault: true, id: { not: locationId } },
        data: { isDefault: false },
      });
      return tx.inventoryLocation.update({
        where: { id: locationId },
        data: { isDefault: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getDefaultOrThrow(tx: Prisma.TransactionClient, tenantId: string) {
    const location = await tx.inventoryLocation.findFirst({
      where: {
        tenantId,
        isDefault: true,
        isActive: true,
        canStoreInventory: true,
        canFulfillRentals: true,
      },
    });
    if (!location) {
      throw new ConflictException({
        code: 'INVENTORY_LOCATION_REQUIRED',
        message: 'Create an active default inventory location before managing rentable stock',
      });
    }
    return location;
  }

  async getActiveOrThrow(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    capability?: 'canStoreInventory' | 'canFulfillRentals' | 'canClean' | 'canRepair',
  ) {
    const location = await this.getById(tx, tenantId, locationId);
    if (!location.isActive || (capability && !location[capability])) {
      throw new ConflictException(`Location is not active or lacks ${capability ?? 'required'} capability`);
    }
    return location;
  }

  private async getById(tx: Prisma.TransactionClient, tenantId: string, locationId: string) {
    const location = await tx.inventoryLocation.findFirst({
      where: { id: locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Inventory location not found');
    return location;
  }

  private async assertCanDeactivate(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
  ) {
    const now = new Date();
    const [stockUnits, pooledStock, activeReservations, activeTransfers] = await Promise.all([
      tx.stockUnit.count({
        where: { tenantId, locationId, deletedAt: null, disposition: { not: 'RETIRED' } },
      }),
      tx.inventoryPool.count({ where: { tenantId, locationId, onHandQuantity: { gt: 0 } } }),
      tx.inventoryReservation.count({
        where: {
          tenantId,
          sourceLocationId: locationId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          blockedEndDate: { gte: now },
        },
      }),
      tx.inventoryTransfer.count({
        where: {
          tenantId,
          status: { in: ['DRAFT', 'READY', 'DISPATCHED', 'PARTIALLY_RECEIVED'] },
          OR: [{ originLocationId: locationId }, { destinationLocationId: locationId }],
        },
      }),
    ]);
    if (stockUnits || pooledStock || activeReservations || activeTransfers) {
      throw new ConflictException({
        code: 'INVENTORY_LOCATION_IN_USE',
        message: 'Move stock and finish reservations and transfers before deactivating this location',
        details: { stockUnits, pooledStock, activeReservations, activeTransfers },
      });
    }
  }

  private assertTimezone(value: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    } catch {
      throw new BadRequestException('Invalid IANA timezone');
    }
  }

  private clean(value?: string): string | null {
    return value?.trim() || null;
  }

  private rethrowUnique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Inventory location code already exists');
    }
    throw error;
  }
}
