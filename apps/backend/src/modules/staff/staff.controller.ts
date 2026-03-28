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
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '@closetrent/types';
import { InviteStaffDto, UpdateStaffDto, StaffQueryDto } from './dto/staff.dto';

@Controller('staff')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /**
   * GET /api/v1/staff
   * List all staff members for the current tenant.
   * Owner only.
   */
  @Get()
  @Roles('owner')
  async listStaff(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: StaffQueryDto,
  ) {
    return this.staffService.listStaff(tenant.id, query);
  }

  /**
   * POST /api/v1/staff
   * Invite a new staff member.
   * Owner only.
   */
  @Post()
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async inviteStaff(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: InviteStaffDto,
  ) {
    return this.staffService.inviteStaff(tenant.id, dto);
  }

  /**
   * GET /api/v1/staff/:id
   * Get details of a specific staff member.
   * Owner only.
   */
  @Get(':id')
  @Roles('owner')
  async getStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.staffService.getStaffById(tenant.id, id);
  }

  /**
   * PATCH /api/v1/staff/:id
   * Update a staff member's role or active status.
   * Owner only.
   */
  @Patch(':id')
  @Roles('owner')
  async updateStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.updateStaff(tenant.id, id, dto);
  }

  /**
   * DELETE /api/v1/staff/:id
   * Remove a staff member from the tenant.
   * Owner only.
   */
  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async removeStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.staffService.removeStaff(tenant.id, id);
  }
}
