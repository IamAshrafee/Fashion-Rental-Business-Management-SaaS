import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, TenantContext } from '@closetrent/types';

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * GET /api/v1/tenant
   * Get the current tenant details (resolved from request context).
   */
  @Get()
  @Roles('owner', 'manager', 'staff')
  async getCurrentTenant(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() _user: AuthUser,
  ) {
    return this.tenantService.findById(tenant.id);
  }
}
