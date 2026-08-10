import { Module, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsScheduler } from './jobs.scheduler';
import { FailedJobsController } from './failed-jobs.controller';
import { NotificationModule } from '../notification/notification.module';
import { FulfillmentModule } from '../fulfillment/fulfillment.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [
    NotificationModule,
    forwardRef(() => FulfillmentModule),
    BookingModule,
  ],
  providers: [JobsService, JobsScheduler],
  controllers: [FailedJobsController],
  exports: [JobsService],
})
export class JobsModule {}
