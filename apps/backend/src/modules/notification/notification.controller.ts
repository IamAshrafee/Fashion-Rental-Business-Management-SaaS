import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification.dto';

@Controller('owner/notifications')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'manager', 'staff')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/v1/owner/notifications
   * List notifications (unread first, paginated)
   */
  @Get()
  async list(
    @CurrentTenant() tenant: { id: string },
    @Query() query: NotificationQueryDto,
  ) {
    const result = await this.notificationService.list(tenant.id, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  /**
   * GET /api/v1/owner/notifications/unread-count
   * Quick badge count
   */
  @Get('unread-count')
  async unreadCount(@CurrentTenant() tenant: { id: string }) {
    const count = await this.notificationService.unreadCount(tenant.id);
    return { success: true, data: { unreadCount: count } };
  }

  /**
   * PATCH /api/v1/owner/notifications/read-all
   * Mark all notifications as read
   */
  @Patch('read-all')
  async markAllRead(@CurrentTenant() tenant: { id: string }) {
    const result = await this.notificationService.markAllRead(tenant.id);
    return { success: true, data: result };
  }

  /**
   * PATCH /api/v1/owner/notifications/:id/read
   * Mark a single notification as read
   */
  @Patch(':id/read')
  async markRead(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
  ) {
    const result = await this.notificationService.markRead(tenant.id, id);
    return { success: true, data: result };
  }

  /**
   * DELETE /api/v1/owner/notifications/:id
   * Dismiss a notification
   */
  @Delete(':id')
  async dismiss(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
  ) {
    await this.notificationService.deleteById(tenant.id, id);
    return { success: true, message: 'Notification dismissed' };
  }
}
