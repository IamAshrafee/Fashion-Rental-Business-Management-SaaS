import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, TenantContext } from '@closetrent/types';

@Controller('sessions')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * GET /api/v1/sessions
   * List all active sessions for the current user.
   */
  @Get()
  async listSessions(@CurrentUser() user: AuthUser) {
    return this.sessionService.listUserSessions(user.id, user.sessionId);
  }

  /**
   * DELETE /api/v1/sessions/others
   * Revoke all sessions except the current one.
   * NOTE: This must be defined BEFORE `:id` to avoid route conflict.
   */
  @Delete('others')
  @HttpCode(HttpStatus.OK)
  async revokeAllOtherSessions(@CurrentUser() user: AuthUser) {
    const count = await this.sessionService.revokeAllOtherSessions(
      user.id,
      user.sessionId,
    );
    return { message: `Revoked ${count} session(s)`, revokedCount: count };
  }

  /**
   * DELETE /api/v1/sessions/:id
   * Revoke a specific session.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.sessionService.revokeSession(sessionId, user.id, user.id);
    return { message: 'Session revoked' };
  }

  /**
   * GET /api/v1/sessions/history
   * Get login history for the current user.
   */
  @Get('history')
  async getLoginHistory(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.sessionService.getLoginHistory(
      user.id,
      page || 1,
      limit || 20,
    );
  }

  /**
   * GET /api/v1/sessions/tenant
   * List all sessions in the tenant (owner oversight).
   */
  @Get('tenant')
  @Roles('owner')
  async listTenantSessions(@CurrentTenant() tenant: TenantContext) {
    return this.sessionService.listTenantSessions(tenant.id);
  }

  /**
   * DELETE /api/v1/sessions/tenant/:id
   * Revoke a staff session (owner action).
   */
  @Delete('tenant/:id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async revokeStaffSession(
    @Param('id') sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    await this.sessionService.revokeStaffSession(sessionId, tenant.id, user.id);
    return { message: 'Staff session revoked' };
  }
}
