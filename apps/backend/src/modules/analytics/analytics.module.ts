import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AnalyticsController, AnalyticsGuestController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnalyticsProcessor } from './analytics.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'analytics-events',
    }),
  ],
  controllers: [AnalyticsController, AnalyticsGuestController],
  providers: [AnalyticsService, AnalyticsProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
