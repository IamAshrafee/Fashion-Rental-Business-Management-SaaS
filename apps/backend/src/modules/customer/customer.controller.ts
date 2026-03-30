import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  AddTagDto,
} from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';

// =========================================================================
// Customer Management Controller
// =========================================================================

@Controller('owner/customers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * GET /owner/customers/lookup?phone=01712345678
   * Customer lookup for checkout auto-fill. Requires auth — returns minimal data.
   */
  @Get('lookup')
  @Roles('owner', 'manager', 'staff')
  async lookup(
    @CurrentTenant() tenant: TenantContext,
    @Query('phone') phone: string,
  ) {
    return this.customerService.lookupByPhone(tenant.id, phone);
  }

  /**
   * GET /owner/customers/tags
   * List all unique tags used in this tenant (for filter dropdown).
   */
  @Get('tags')
  @Roles('owner', 'manager', 'staff')
  async listTags(@CurrentTenant() tenant: TenantContext) {
    return this.customerService.listTenantTags(tenant.id);
  }

  // --- CRUD ---

  @Get()
  @Roles('owner', 'manager', 'staff')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customerService.list(tenant.id, query);
  }

  @Get(':id')
  @Roles('owner', 'manager', 'staff')
  async getById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.customerService.getById(tenant.id, id);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customerService.create(tenant.id, dto);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.customerService.softDelete(tenant.id, id);
  }

  // --- Tags ---

  @Post(':id/tags')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addTag(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AddTagDto,
  ) {
    return this.customerService.addTag(tenant.id, id, dto.tag);
  }

  @Delete(':id/tags/:tag')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  async removeTag(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('tag') tag: string,
  ) {
    return this.customerService.removeTag(tenant.id, id, tag);
  }
}
