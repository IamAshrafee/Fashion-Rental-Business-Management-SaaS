import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '@closetrent/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  CreateInventoryTransferDto,
  InventoryTransferActionDto,
  ListInventoryTransfersQueryDto,
  ReceiveInventoryTransferDto,
} from './dto/inventory-transfer.dto';
import { InventoryTransferService } from './inventory-transfer.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('owner/inventory/transfers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InventoryTransferController {
  constructor(private readonly transfers: InventoryTransferService) {}

  @Get()
  @Roles('owner', 'manager', 'staff')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListInventoryTransfersQueryDto,
  ) {
    return this.transfers.list(tenant.id, query.status);
  }

  @Get(':transferId')
  @Roles('owner', 'manager', 'staff')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('transferId') transferId: string,
  ) {
    return this.transfers.get(tenant.id, transferId);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInventoryTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.create(tenant.id, dto, request.user.id);
  }

  @Post(':transferId/ready')
  @Roles('owner', 'manager')
  markReady(
    @CurrentTenant() tenant: TenantContext,
    @Param('transferId') transferId: string,
    @Body() dto: InventoryTransferActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.markReady(tenant.id, transferId, dto, request.user.id);
  }

  @Post(':transferId/dispatch')
  @Roles('owner', 'manager', 'staff')
  dispatch(
    @CurrentTenant() tenant: TenantContext,
    @Param('transferId') transferId: string,
    @Body() dto: InventoryTransferActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.dispatch(tenant.id, transferId, dto, request.user.id);
  }

  @Post(':transferId/receive')
  @Roles('owner', 'manager', 'staff')
  receive(
    @CurrentTenant() tenant: TenantContext,
    @Param('transferId') transferId: string,
    @Body() dto: ReceiveInventoryTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.receive(tenant.id, transferId, dto, request.user.id);
  }

  @Post(':transferId/reconcile')
  @Roles('owner', 'manager')
  reconcile(
    @CurrentTenant() tenant: TenantContext,
    @Param('transferId') transferId: string,
    @Body() dto: InventoryTransferActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.reconcile(tenant.id, transferId, dto, request.user.id);
  }

  @Post(':transferId/cancel')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('transferId') transferId: string,
    @Body() dto: InventoryTransferActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.cancel(tenant.id, transferId, dto, request.user.id);
  }
}
