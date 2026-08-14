import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '@closetrent/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  AvailabilityPolicyVersionDto,
  CreateInventoryLocationDto,
  InventoryItemsQueryDto,
  InventoryMovementsQueryDto,
  InventorySkusQueryDto,
  ReconcileInventoryCountDto,
  ResolveAvailabilityPolicyQueryDto,
  UpdateInventoryLocationDto,
  UpsertAvailabilityPolicyDto,
} from './dto/inventory-foundation.dto';
import { CreateInventoryBlockDto, InventoryBlocksQueryDto } from './dto/inventory-block.dto';
import { AvailabilityPolicyService } from './availability-policy.service';
import { InventoryLocationService } from './inventory-location.service';
import { InventoryDashboardService } from './inventory-dashboard.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryBlockService } from './inventory-block.service';
import { InventoryCountService } from './inventory-count.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('owner/inventory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@RequirePermission('manage_inventory')
export class InventoryFoundationController {
  constructor(
    private readonly locations: InventoryLocationService,
    private readonly policies: AvailabilityPolicyService,
    private readonly dashboard: InventoryDashboardService,
    private readonly ledger: InventoryLedgerService,
    private readonly blocks: InventoryBlockService,
    private readonly counts: InventoryCountService,
  ) {}

  @Get('overview')
  @Roles('owner', 'manager', 'staff')
  overview(@CurrentTenant() tenant: TenantContext) {
    return this.dashboard.overview(tenant.id);
  }

  @Get('items')
  @Roles('owner', 'manager', 'staff')
  listItems(@CurrentTenant() tenant: TenantContext, @Query() query: InventoryItemsQueryDto) {
    return this.dashboard.listItems(tenant.id, query);
  }

  @Get('skus')
  @Roles('owner', 'manager', 'staff')
  listSkus(@CurrentTenant() tenant: TenantContext, @Query() query: InventorySkusQueryDto) {
    return this.dashboard.listSkus(tenant.id, query);
  }

  @Get('movements')
  @Roles('owner', 'manager', 'staff')
  listMovements(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryMovementsQueryDto,
  ) {
    return this.ledger.listMovements(tenant.id, query);
  }

  @Get('counts')
  @Roles('owner', 'manager', 'staff')
  listCounts(@CurrentTenant() tenant: TenantContext, @Query() query: InventoryMovementsQueryDto) {
    return this.counts.list(tenant.id, query);
  }

  @Get('counts/:countSessionId')
  @Roles('owner', 'manager', 'staff')
  getCount(
    @CurrentTenant() tenant: TenantContext,
    @Param('countSessionId', ParseUUIDPipe) countSessionId: string,
  ) {
    return this.counts.get(tenant.id, countSessionId);
  }

  @Post('counts/reconcile')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  reconcileCount(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ReconcileInventoryCountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.counts.reconcile(tenant.id, dto, request.user.id);
  }

  @Get('locations')
  @Roles('owner', 'manager', 'staff')
  listLocations(
    @CurrentTenant() tenant: TenantContext,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.locations.list(tenant.id, includeInactive === 'true');
  }

  @Post('locations')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  createLocation(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInventoryLocationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.locations.create(tenant.id, dto, request.user.id);
  }

  @Patch('locations/:locationId')
  @Roles('owner', 'manager')
  updateLocation(
    @CurrentTenant() tenant: TenantContext,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateInventoryLocationDto,
  ) {
    return this.locations.update(tenant.id, locationId, dto);
  }

  @Post('locations/:locationId/default')
  @Roles('owner', 'manager')
  setDefaultLocation(
    @CurrentTenant() tenant: TenantContext,
    @Param('locationId') locationId: string,
  ) {
    return this.locations.setDefault(tenant.id, locationId);
  }

  @Get('availability-policies')
  @Roles('owner', 'manager', 'staff')
  listPolicies(@CurrentTenant() tenant: TenantContext) {
    return this.policies.list(tenant.id);
  }

  @Get('availability-policies/resolved')
  @Roles('owner', 'manager', 'staff')
  resolvePolicy(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ResolveAvailabilityPolicyQueryDto,
  ) {
    return this.policies.resolveForOwner(tenant.id, query);
  }

  @Put('availability-policies')
  @Roles('owner', 'manager')
  upsertPolicy(@CurrentTenant() tenant: TenantContext, @Body() dto: UpsertAvailabilityPolicyDto) {
    return this.policies.upsert(tenant.id, dto);
  }

  @Delete('availability-policies/:policyId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  deactivatePolicy(
    @CurrentTenant() tenant: TenantContext,
    @Param('policyId') policyId: string,
    @Query() query: AvailabilityPolicyVersionDto,
  ) {
    return this.policies.deactivate(tenant.id, policyId, query.expectedVersion);
  }

  @Get('blocks')
  @Roles('owner', 'manager', 'staff')
  listBlocks(@CurrentTenant() tenant: TenantContext, @Query() query: InventoryBlocksQueryDto) {
    return this.blocks.list(tenant.id, query);
  }

  @Post('blocks/preview')
  @Roles('owner', 'manager')
  previewBlock(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateInventoryBlockDto) {
    return this.blocks.preview(tenant.id, dto);
  }

  @Post('blocks')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  createBlock(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInventoryBlockDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.blocks.create(tenant.id, dto, request.user.id);
  }

  @Delete('blocks/:blockId')
  @Roles('owner', 'manager')
  removeBlock(
    @CurrentTenant() tenant: TenantContext,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.blocks.remove(tenant.id, blockId);
  }
}
