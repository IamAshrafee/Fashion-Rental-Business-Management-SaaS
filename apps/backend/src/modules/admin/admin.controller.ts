import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@closetrent/types';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

/**
 * Admin API Controller.
 * Bypasses regular tenant resolution to manage SaaS platform state.
 * Protected by saas_admin role requirement.
 */
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('saas_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =========================================================================
  // TENANTS
  // =========================================================================

  @Get('tenants')
  async getTenants(
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getTenants({ status, plan, search, page: page!, limit: limit!, sort });
  }

  @Get('tenants/:id')
  async getTenantDetail(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(@Param('id') id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.adminService.updateTenantStatus(id, dto);
  }

  @Patch('tenants/:id/plan')
  async updateTenantPlan(@Param('id') id: string, @Body() dto: UpdateTenantPlanDto) {
    return this.adminService.updateTenantPlan(id, dto);
  }

  @Post('tenants/:id/impersonate')
  async impersonateTenant(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.impersonateTenant(user.id, id);
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  @Get('analytics/platform')
  async getPlatformAnalytics() {
    return this.adminService.getPlatformAnalytics();
  }

  // =========================================================================
  // PLAN MANAGEMENT
  // =========================================================================

  @Get('plans')
  async getPlans() {
    return this.adminService.getPlans();
  }

  @Post('plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.adminService.updatePlan(id, dto);
  }
}
