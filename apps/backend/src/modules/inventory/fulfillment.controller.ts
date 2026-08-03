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
import { AssignStockUnitsDto, ReleaseAssignmentDto } from './dto/inventory.dto';
import {
  CreateCompositionRuleDto,
  ExtendFulfillmentRequirementDto,
  RecordFulfillmentEventDto,
  SubstituteFulfillmentRequirementDto,
  UpdateCompositionRuleDto,
} from './dto/fulfillment.dto';
import { FulfillmentService } from './fulfillment.service';
import { InventoryAssignmentService } from './inventory-assignment.service';
import { ProductCompositionService } from './product-composition.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller('products')
export class FulfillmentGuestController {
  constructor(private readonly composition: ProductCompositionService) {}

  @Public()
  @Get(':productId/composition')
  listComposition(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
  ) {
    return this.composition.list(tenant.id, productId, true);
  }
}

@Controller('owner')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class FulfillmentOwnerController {
  constructor(
    private readonly composition: ProductCompositionService,
    private readonly fulfillment: FulfillmentService,
    private readonly assignments: InventoryAssignmentService,
  ) {}

  @Get('products/:productId/composition')
  @Roles('owner', 'manager', 'staff')
  listComposition(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
  ) {
    return this.composition.list(tenant.id, productId, false);
  }

  @Post('products/:productId/composition')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  createCompositionRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('productId') productId: string,
    @Body() dto: CreateCompositionRuleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.composition.create(tenant.id, productId, dto, request.user?.id);
  }

  @Patch('composition/:ruleId')
  @Roles('owner', 'manager')
  updateCompositionRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateCompositionRuleDto,
  ) {
    return this.composition.update(tenant.id, ruleId, dto);
  }

  @Delete('composition/:ruleId')
  @Roles('owner', 'manager')
  deactivateCompositionRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('ruleId') ruleId: string,
  ) {
    return this.composition.deactivate(tenant.id, ruleId);
  }

  @Get('bookings/:bookingId/fulfillment')
  @Roles('owner', 'manager', 'staff')
  listBookingRequirements(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
  ) {
    return this.fulfillment.listBookingRequirements(tenant.id, bookingId);
  }

  @Patch('bookings/:bookingId/fulfillment/dates')
  @Roles('owner', 'manager')
  extendBookingRequirements(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Body() dto: ExtendFulfillmentRequirementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fulfillment.extendBookingRequirements(tenant.id, bookingId, dto, request.user?.id);
  }

  @Post('fulfillment/requirements/:requirementId/substitute')
  @Roles('owner', 'manager')
  substitute(
    @CurrentTenant() tenant: TenantContext,
    @Param('requirementId') requirementId: string,
    @Body() dto: SubstituteFulfillmentRequirementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fulfillment.substitute(tenant.id, requirementId, dto, request.user?.id);
  }

  @Post('fulfillment/requirements/:requirementId/events')
  @Roles('owner', 'manager', 'staff')
  recordEvent(
    @CurrentTenant() tenant: TenantContext,
    @Param('requirementId') requirementId: string,
    @Body() dto: RecordFulfillmentEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fulfillment.recordEvent(tenant.id, requirementId, dto, request.user?.id);
  }

  @Get('bookings/:bookingId/items/:bookingItemId/requirements/:requirementId/assignments')
  @Roles('owner', 'manager', 'staff')
  listRequirementAssignments(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Param('bookingItemId') bookingItemId: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.assignments.listEligibleUnits(tenant.id, bookingId, bookingItemId, requirementId);
  }

  @Post('bookings/:bookingId/items/:bookingItemId/requirements/:requirementId/assignments')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  assignRequirementUnits(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Param('bookingItemId') bookingItemId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: AssignStockUnitsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignments.assign(
      tenant.id,
      bookingId,
      bookingItemId,
      dto.stockUnitIds,
      request.user?.id,
      requirementId,
    );
  }

  @Delete('bookings/:bookingId/items/:bookingItemId/requirements/:requirementId/assignments/:assignmentId')
  @Roles('owner', 'manager', 'staff')
  releaseRequirementAssignment(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId') bookingId: string,
    @Param('bookingItemId') bookingItemId: string,
    @Param('requirementId') requirementId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReleaseAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assignments.release(
      tenant.id,
      bookingId,
      bookingItemId,
      assignmentId,
      dto.reason,
      request.user?.id,
      requirementId,
    );
  }
}
