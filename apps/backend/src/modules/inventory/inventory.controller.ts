import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '@closetrent/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  ConfigureVariantSizeInventoryDto,
  CreateInventoryBlockDto,
  CreateStockUnitDto,
  InventoryCalendarQueryDto,
  PublicAvailabilityQueryDto,
  StockUnitLifecycleDto,
  UpdateStockUnitDto,
} from './dto/inventory.dto';
import { InventoryAvailabilityService } from './inventory-availability.service';
import { InventoryManagementService } from './inventory-management.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('products')
export class InventoryGuestController {
  constructor(private readonly availability: InventoryAvailabilityService) {}

  @Public()
  @Get(':productId/availability')
  async checkAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Query() query: PublicAvailabilityQueryDto,
  ) {
    return this.availability.check({
      tenantId: tenant.id,
      productId,
      variantSizeId: query.variantSizeId,
      startDate: query.startDate,
      endDate: query.endDate,
      quantity: query.quantity,
    });
  }

  @Public()
  @Get(':productId/item-options')
  async listItemOptions(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Query() query: PublicAvailabilityQueryDto,
  ) {
    return this.availability.listPublicItemOptions(tenant.id, productId, query);
  }
}

@Controller('owner')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InventoryOwnerController {
  constructor(private readonly inventory: InventoryManagementService) {}

  @Get('products/:productId/inventory')
  @Roles('owner', 'manager', 'staff')
  async getProductInventory(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
  ) {
    return this.inventory.getProductInventory(tenant.id, productId);
  }

  @Get('products/:productId/inventory/calendar')
  @Roles('owner', 'manager', 'staff')
  async getCalendar(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Query() query: InventoryCalendarQueryDto,
  ) {
    return this.inventory.getCalendar(tenant.id, productId, query);
  }

  @Patch('variant-sizes/:variantSizeId/inventory')
  @Roles('owner', 'manager')
  async configureVariantSize(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
    @Body() dto: ConfigureVariantSizeInventoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.configureVariantSize(
      tenant.id,
      variantSizeId,
      dto,
      request.user?.id,
    );
  }

  @Get('variant-sizes/:variantSizeId/stock-units')
  @Roles('owner', 'manager', 'staff')
  async listStockUnits(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
  ) {
    return this.inventory.listStockUnits(tenant.id, variantSizeId);
  }

  @Post('variant-sizes/:variantSizeId/stock-units')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createStockUnit(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
    @Body() dto: CreateStockUnitDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.createStockUnit(tenant.id, variantSizeId, dto, request.user?.id);
  }

  @Patch('stock-units/:stockUnitId')
  @Roles('owner', 'manager')
  async updateStockUnit(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: UpdateStockUnitDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.updateStockUnit(tenant.id, stockUnitId, dto, request.user?.id);
  }

  @Post('stock-units/:stockUnitId/maintenance')
  @Roles('owner', 'manager', 'staff')
  async startMaintenance(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: StockUnitLifecycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.changeStockUnitLifecycle(
      tenant.id,
      stockUnitId,
      'maintenance',
      dto.reason,
      request.user?.id,
    );
  }

  @Post('stock-units/:stockUnitId/restore')
  @Roles('owner', 'manager', 'staff')
  async restoreStockUnit(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: StockUnitLifecycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.changeStockUnitLifecycle(
      tenant.id,
      stockUnitId,
      'restore',
      dto.reason,
      request.user?.id,
    );
  }

  @Post('stock-units/:stockUnitId/retire')
  @Roles('owner', 'manager')
  async retireStockUnit(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: StockUnitLifecycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.changeStockUnitLifecycle(
      tenant.id,
      stockUnitId,
      'retire',
      dto.reason,
      request.user?.id,
    );
  }

  @Post('stock-units/:stockUnitId/lost')
  @Roles('owner', 'manager')
  async markStockUnitLost(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: StockUnitLifecycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.changeStockUnitLifecycle(
      tenant.id,
      stockUnitId,
      'lost',
      dto.reason,
      request.user?.id,
    );
  }

  @Get('variant-sizes/:variantSizeId/inventory-movements')
  @Roles('owner', 'manager', 'staff')
  async listMovements(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
  ) {
    return this.inventory.listMovements(tenant.id, variantSizeId);
  }

  @Post('inventory/blocks')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createBlock(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInventoryBlockDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.createBlock(tenant.id, dto, request.user?.id);
  }

  @Delete('inventory/blocks/:blockId')
  @Roles('owner', 'manager')
  async deleteBlock(
    @CurrentTenant() tenant: TenantContext,
    @Param('blockId') blockId: string,
  ) {
    return this.inventory.deleteBlock(tenant.id, blockId);
  }

}
