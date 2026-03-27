import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateDateBlockDto } from './dto/product.dto';
import { Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

// Guest availability endpoints
@Controller('products')
export class InventoryGuestController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Public()
  @Get(':id/availability')
  async checkAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.inventoryService.checkAvailability(tenant.id, productId, startDate, endDate);
  }

  @Public()
  @Get(':id/calendar')
  async getCalendar(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Query('months') months?: number,
  ) {
    return this.inventoryService.getCalendar(tenant.id, productId, months || 3);
  }
}

// Owner date block endpoints
@Controller('owner/products')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InventoryOwnerController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post(':id/block-dates')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async blockDates(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Body() dto: CreateDateBlockDto,
  ) {
    return this.inventoryService.blockDates(tenant.id, productId, dto);
  }

  @Delete(':id/block-dates/:blockId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async unblockDates(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
    @Param('blockId') blockId: string,
  ) {
    return this.inventoryService.unblockDates(tenant.id, productId, blockId);
  }

  @Get(':id/blocks')
  @Roles('owner', 'manager', 'staff')
  async listBlocks(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') productId: string,
  ) {
    return this.inventoryService.listBlocks(tenant.id, productId);
  }
}
