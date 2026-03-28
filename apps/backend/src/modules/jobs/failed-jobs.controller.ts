import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from './jobs.service';

/**
 * Admin endpoint for viewing and retrying failed BullMQ jobs.
 * Protected by saas_admin role only.
 */
@Controller('admin/failed-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('saas_admin')
export class FailedJobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * GET /api/v1/admin/failed-jobs
   * List all failed jobs from the dead letter store
   */
  @Get()
  async list() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs = await (this.prisma as any).failedJob.findMany({
      orderBy: { failedAt: 'desc' },
      take: 100,
    });

    return { success: true, data: jobs };
  }

  /**
   * POST /api/v1/admin/failed-jobs/:id/retry
   * Manually retry a failed job by re-adding it to its queue
   */
  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const failedJob = await (this.prisma as any).failedJob.findUnique({ where: { id } });

    if (!failedJob) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Failed job not found' } };
    }

    const queue =
      failedJob.queue === 'notifications'
        ? this.jobsService.notificationsQueue
        : failedJob.queue === 'scheduler'
          ? this.jobsService.schedulerQueue
          : this.jobsService.cleanupQueue;

    await queue.add(failedJob.jobName, failedJob.payload);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prisma as any).failedJob.update({
      where: { id },
      data: { retriedAt: new Date() },
    });

    return { success: true, message: `Job ${failedJob.jobName} re-queued successfully` };
  }
}
