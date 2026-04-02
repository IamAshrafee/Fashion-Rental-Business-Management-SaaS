import { Module, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsScheduler } from './jobs.scheduler';
import { FailedJobsController } from './failed-jobs.controller';
import { NotificationModule } from '../notification/notification.module';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';

@Module({
  imports: [
    NotificationModule,
    forwardRef(() => FulfillmentModule),
  ],
  providers: [JobsService, JobsScheduler],
  controllers: [FailedJobsController],
  exports: [JobsService],
})
export class JobsModule {}
