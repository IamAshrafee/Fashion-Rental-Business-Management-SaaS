import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AuditLogService, AuditLogQueryDto } from './audit-log.service';

@Controller('owner/audit-logs')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'manager')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * GET /api/v1/owner/audit-logs
   * Paginated audit log history, filterable by entity type and date range
   */
  @Get()
  async list(
    @CurrentTenant() tenant: { id: string },
    @Query() query: AuditLogQueryDto,
  ) {
    const result = await this.auditLogService.findMany(tenant.id, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }
}
