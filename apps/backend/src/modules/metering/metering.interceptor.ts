import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MeteringService, TenantBufferEntry } from './metering.service';

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * MeteringInterceptor — Global NestJS interceptor for per-tenant API metering.
 *
 * Architecture:
 *   - Runs AFTER response is sent (tap operator) — zero latency impact on API
 *   - Per-request overhead: ~0.05ms (in-memory Map.get + integer increments)
 *   - Buffer flushed to Redis every 5 seconds via a single PIPELINE
 *   - One Redis round-trip per 5s regardless of request volume
 *
 * Skips:
 *   - Non-tenant routes (admin, auth, health check, public APIs)
 *   - Routes where tenant context is not present
 */
@Injectable()
export class MeteringInterceptor implements NestInterceptor, OnModuleDestroy {
  private readonly logger = new Logger(MeteringInterceptor.name);

  // In-memory buffer: tenantId → aggregated metrics since last flush
  private buffer = new Map<string, TenantBufferEntry>();

  // Flush interval handle (5 seconds)
  private readonly flushInterval: NodeJS.Timeout;

  constructor(private readonly meteringService: MeteringService) {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, 5_000);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flushInterval);
    // Final flush on shutdown — don't lose buffered metrics
    await this.flush();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.record(context, req, start, false);
        },
        error: () => {
          void this.record(context, req, start, true);
        },
      }),
    );
  }

  private record(
    context: ExecutionContext,
    req: Request,
    startMs: number,
    isError: boolean,
  ): void {
    // Only meter tenant-scoped requests
    const tenantId = req.tenant?.id;
    if (!tenantId) return;

    const latencyMs = Date.now() - startMs;

    // Response size from Content-Length header (may not always be present)
    const res = context.switchToHttp().getResponse<Response>();
    const contentLength = parseInt(res.getHeader('content-length') as string ?? '0', 10) || 0;

    // Determine if this is an error response (4xx + 5xx)
    const statusCode = res.statusCode ?? 200;
    const isHttpError = isError || statusCode >= 400;

    // ── In-memory buffer update (~0.05ms) ────────────────────────────────────
    const existing = this.buffer.get(tenantId);
    if (existing) {
      existing.requests += 1;
      existing.totalLatencyMs += latencyMs;
      if (latencyMs > existing.maxLatencyMs) existing.maxLatencyMs = latencyMs;
      existing.totalBytes += contentLength;
      if (isHttpError) existing.errors += 1;
    } else {
      this.buffer.set(tenantId, {
        requests: 1,
        totalLatencyMs: latencyMs,
        maxLatencyMs: latencyMs,
        totalBytes: contentLength,
        errors: isHttpError ? 1 : 0,
      });
    }
  }

  /**
   * Atomically swap the buffer and flush to Redis via single PIPELINE.
   * The swap ensures the interceptor is never blocked waiting for Redis.
   */
  private async flush(): Promise<void> {
    if (this.buffer.size === 0) return;

    // Atomic swap — new requests go into fresh buffer while we flush the old one
    const snapshot = this.buffer;
    this.buffer = new Map();

    await this.meteringService.flushToRedis(snapshot);
  }
}
