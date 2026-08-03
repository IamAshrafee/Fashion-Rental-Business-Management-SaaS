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
  Put,
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
  CreateInventoryLocationDto,
  SetInventoryPoolQuantityDto,
  UpdateInventoryLocationDto,
  UpsertAvailabilityPolicyDto,
} from './dto/inventory-foundation.dto';
import { AvailabilityPolicyService } from './availability-policy.service';
import { InventoryLocationService } from './inventory-location.service';
import { InventoryPoolService } from './inventory-pool.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('owner/inventory')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InventoryFoundationController {
  constructor(
    private readonly locations: InventoryLocationService,
    private readonly pools: InventoryPoolService,
    private readonly policies: AvailabilityPolicyService,
  ) {}

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

  @Get('variant-sizes/:variantSizeId/pools')
  @Roles('owner', 'manager', 'staff')
  listPools(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
  ) {
    return this.pools.listForSku(tenant.id, variantSizeId);
  }

  @Put('variant-sizes/:variantSizeId/pools')
  @Roles('owner', 'manager')
  setPoolQuantity(
    @CurrentTenant() tenant: TenantContext,
    @Param('variantSizeId') variantSizeId: string,
    @Body() dto: SetInventoryPoolQuantityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.pools.setQuantity(tenant.id, variantSizeId, dto, request.user.id);
  }

  @Get('availability-policies')
  @Roles('owner', 'manager', 'staff')
  listPolicies(@CurrentTenant() tenant: TenantContext) {
    return this.policies.list(tenant.id);
  }

  @Put('availability-policies')
  @Roles('owner', 'manager')
  upsertPolicy(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpsertAvailabilityPolicyDto,
  ) {
    return this.policies.upsert(tenant.id, dto);
  }

  @Delete('availability-policies/:policyId')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  deactivatePolicy(
    @CurrentTenant() tenant: TenantContext,
    @Param('policyId') policyId: string,
  ) {
    return this.policies.deactivate(tenant.id, policyId);
  }
}
