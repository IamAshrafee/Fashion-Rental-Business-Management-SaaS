import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { StorefrontEventPayload } from '@closetrent/types';
import { Prisma } from '@prisma/client';

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
          metadata: (metadata || {}) as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      // Real-time popularity score increment (write-through)
      // product_view = +1 point, add_to_cart = +3 points (stronger purchase intent signal)
      if (productId && (eventType === 'product_view' || eventType === 'add_to_cart')) {
        const increment = eventType === 'add_to_cart' ? 3 : 1;
        await this.prisma.product.update({
          where: { id: productId },
          data: { popularityScore: { increment } },
        }).catch((error: unknown) => {
          // Non-critical — don't fail the event if the product doesn't exist
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to increment popularity for product ${productId}: ${message}`);
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to ingest analytics event: ${message}`, stack);
      // We don't necessarily want to retry endlessly for analytics
      throw error;
    }
  }
}
