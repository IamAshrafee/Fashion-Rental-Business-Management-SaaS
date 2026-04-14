import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { StorefrontEventPayload } from '@closetrent/types';

@Processor('analytics-events')
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('track-event')
  async handleTrackEvent(job: Job<StorefrontEventPayload & { tenantId: string; ipAddress?: string; userAgent?: string }>) {
    const { tenantId, sessionId, eventType, productId, variantId, metadata, ipAddress, userAgent } = job.data;

    try {
      await this.prisma.storefrontEvent.create({
        data: {
          tenantId,
          sessionId,
          eventType,
          productId,
          variantId,
          metadata: metadata || {},
          ipAddress,
          userAgent,
        },
      });
      // Silent success for max performance
    } catch (error: any) {
      this.logger.error(`Failed to ingest analytics event: ${error?.message}`, error?.stack);
      // We don't necessarily want to retry endlessly for analytics
      throw error;
    }
  }
}
