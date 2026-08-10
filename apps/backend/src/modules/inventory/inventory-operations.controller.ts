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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  ChangeStockUnitDispositionDto,
  CancelInventoryServiceOrderDto,
  CompleteInventoryServiceOrderDto,
  CompleteStockUnitInspectionDto,
  CreateInventoryServiceOrderDto,
  CreateSkuSetComponentDto,
  CreateStockUnitInspectionDto,
  InventoryAttentionQueryDto,
  InventoryServiceQueueQueryDto,
  ResolveStockUnitIssueDto,
  ReplaceStockUnitReferenceMediaDto,
  StartInventoryServiceOrderDto,
  TransitionStockUnitOperationalStateDto,
  UpdateStockUnitComponentStateDto,
} from './dto/inventory-operations.dto';
import { InventoryServiceOrderService } from './inventory-service-order.service';
import { StockUnitInspectionService } from './stock-unit-inspection.service';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';
import { StockUnitSetService } from './stock-unit-set.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('owner/inventory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InventoryOperationsController {
  constructor(
    private readonly lifecycle: StockUnitLifecycleService,
    private readonly inspections: StockUnitInspectionService,
    private readonly serviceOrders: InventoryServiceOrderService,
    private readonly sets: StockUnitSetService,
  ) {}

  @Get('inspections')
  @Roles('owner', 'manager', 'staff')
  listInspectionAttention(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryAttentionQueryDto,
  ) {
    return this.inspections.listAttention(tenant.id, query);
  }

  @Get('service-orders')
  @Roles('owner', 'manager', 'staff')
  listServiceQueue(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryServiceQueueQueryDto,
  ) {
    return this.serviceOrders.listQueue(tenant.id, query);
  }

  @Get('stock-units/:stockUnitId/operations')
  @Roles('owner', 'manager', 'staff')
  async getUnitOperations(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
  ) {
    const [history, serviceOrders] = await Promise.all([
      this.inspections.listForUnit(tenant.id, stockUnitId),
      this.serviceOrders.listForUnit(tenant.id, stockUnitId),
    ]);
    return { ...history, serviceOrders };
  }

  @Post('stock-units/:stockUnitId/transitions')
  @Roles('owner', 'manager', 'staff')
  async transitionOperationalState(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: TransitionStockUnitOperationalStateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lifecycle.transition({
      tenantId: tenant.id,
      stockUnitId,
      actorUserId: request.user.id,
      reason: dto.reason,
      targetOperationalState: dto.targetState,
      assignmentId: dto.assignmentId,
      serviceOrderId: dto.serviceOrderId,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post('stock-units/:stockUnitId/disposition')
  @Roles('owner', 'manager')
  async changeDisposition(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: ChangeStockUnitDispositionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lifecycle.transition({
      tenantId: tenant.id,
      stockUnitId,
      actorUserId: request.user.id,
      reason: dto.reason,
      targetDisposition: dto.targetDisposition,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post('stock-units/:stockUnitId/inspections')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async createInspection(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: CreateStockUnitInspectionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspections.create(tenant.id, stockUnitId, dto, request.user.id);
  }

  @Post('inspections/:inspectionId/complete')
  @Roles('owner', 'manager', 'staff')
  async completeInspection(
    @CurrentTenant() tenant: TenantContext,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: CompleteStockUnitInspectionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspections.complete(tenant.id, inspectionId, dto, request.user.id);
  }

  @Patch('stock-units/:stockUnitId/reference-media')
  @Roles('owner', 'manager')
  async replaceReferenceMedia(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: ReplaceStockUnitReferenceMediaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspections.replaceReferenceMedia(
      tenant.id,
      stockUnitId,
      dto,
      request.user.id,
    );
  }

  @Post('issues/:issueId/resolve')
  @Roles('owner', 'manager', 'staff')
  async resolveIssue(
    @CurrentTenant() tenant: TenantContext,
    @Param('issueId') issueId: string,
    @Body() dto: ResolveStockUnitIssueDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspections.resolveIssue(tenant.id, issueId, dto, request.user.id);
  }

  @Post('stock-units/:stockUnitId/service-orders')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async createServiceOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Body() dto: CreateInventoryServiceOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrders.create(tenant.id, stockUnitId, dto, request.user.id);
  }

  @Post('service-orders/:serviceOrderId/start')
  @Roles('owner', 'manager', 'staff')
  async startServiceOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: StartInventoryServiceOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrders.start(tenant.id, serviceOrderId, dto, request.user.id);
  }

  @Post('service-orders/:serviceOrderId/complete')
  @Roles('owner', 'manager', 'staff')
  async completeServiceOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: CompleteInventoryServiceOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrders.complete(tenant.id, serviceOrderId, dto, request.user.id);
  }

  @Post('service-orders/:serviceOrderId/cancel')
  @Roles('owner', 'manager', 'staff')
  async cancelServiceOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: CancelInventoryServiceOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.serviceOrders.cancel(tenant.id, serviceOrderId, dto, request.user.id);
  }

  @Get('variant-sizes/:variantSizeId/set-components')
  @Roles('owner', 'manager', 'staff')
  async listSetComponents(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
  ) {
    return this.sets.listDefinitions(tenant.id, variantSizeId);
  }

  @Post('variant-sizes/:variantSizeId/set-components')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createSetComponent(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
    @Body() dto: CreateSkuSetComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sets.createDefinition(tenant.id, variantSizeId, dto, request.user.id);
  }

  @Delete('set-components/:definitionId')
  @Roles('owner', 'manager')
  async deactivateSetComponent(
    @CurrentTenant() tenant: TenantContext,
    @Param('definitionId') definitionId: string,
  ) {
    return this.sets.deactivateDefinition(tenant.id, definitionId);
  }

  @Patch('stock-units/:stockUnitId/set-components/:definitionId')
  @Roles('owner', 'manager', 'staff')
  async updateUnitComponentState(
    @CurrentTenant() tenant: TenantContext,
    @Param('stockUnitId') stockUnitId: string,
    @Param('definitionId') definitionId: string,
    @Body() dto: UpdateStockUnitComponentStateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sets.updateUnitState(
      tenant.id,
      stockUnitId,
      definitionId,
      dto,
      request.user.id,
    );
  }
}
