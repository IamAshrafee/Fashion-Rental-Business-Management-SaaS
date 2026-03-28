import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsScheduler } from './jobs.scheduler';
import { FailedJobsController } from './failed-jobs.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [JobsService, JobsScheduler],
  controllers: [FailedJobsController],
  exports: [JobsService],
})
export class JobsModule {}
