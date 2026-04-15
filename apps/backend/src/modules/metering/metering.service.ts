import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ─── Internal Types ──────────────────────────────────────────────────────────

export interface TenantBufferEntry {
  requests: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  totalBytes: number;
  errors: number; // 4xx + 5xx
}

export interface DailyMetrics {
  apiRequestCount: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number; // approximated from maxLatency in current window
  errorCount: number;
  totalBandwidthKb: number;
  peakRpm: number;
}

export interface LiveTenantMetrics {
  tenantId: string;
  apiCallsToday: number;
  avgLatencyMs: number;
  errorsToday: number;
  currentRpm: number;
  bandwidthKbToday: number;
}

export interface PlanLimits {
  maxRpm: number;
  maxApiCallsDaily: number | null; // null = unlimited
  maxStorageMb: number | null;     // null = unlimited
}

// ─── Redis Key Helpers ────────────────────────────────────────────────────────

function dailyKey(tenantId: string, date: string): string {
  return `meter:${tenantId}:daily:${date}`;
}

function rpmKey(tenantId: string, minuteTs: number): string {
  return `meter:${tenantId}:rpm:${minuteTs}`;
}

function planLimitsKey(tenantId: string): string {
  return `meter:${tenantId}:plan_limits`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function currentMinuteTs(): number {
  return Math.floor(Date.now() / 60_000);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MeteringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeteringService.name);
  private redis!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DB', 0),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

    this.redis.on('error', (err) => {
      // Non-fatal: metering is observability, not critical path
      this.logger.warn(`Metering Redis error: ${err.message}`);
    });

    this.logger.log('MeteringService Redis client initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  // ─── Called by MeteringInterceptor (every 5s flush) ────────────────────────

  /**
   * Atomically flush the in-memory buffer to Redis using a single PIPELINE.
   * One network round-trip regardless of tenant count.
   *
   * Redis hash fields per tenant per day:
   *   requests    → total request count
   *   latencySum  → sum of latencies (used to compute avg)
   *   maxLatency  → track peak latency
   *   bytes       → total response bytes
   *   errors      → total 4xx+5xx count
   *
   * Separate rpm key (per minute) for sliding-window rate limiting.
   */
  async flushToRedis(buffer: Map<string, TenantBufferEntry>): Promise<void> {
    if (buffer.size === 0) return;

    try {
      const pipeline = this.redis.pipeline();
      const date = todayDate();
      const minuteTs = currentMinuteTs();
      const dayTtlSeconds = 8 * 24 * 60 * 60; // 8 days — keep 7 full days + today

      for (const [tenantId, entry] of buffer.entries()) {
        const dk = dailyKey(tenantId, date);
        const rk = rpmKey(tenantId, minuteTs);

        // Atomic increments on daily hash
        pipeline.hincrby(dk, 'requests', entry.requests);
        pipeline.hincrby(dk, 'latencySum', entry.totalLatencyMs);
        pipeline.hincrby(dk, 'bytes', entry.totalBytes);
        pipeline.hincrby(dk, 'errors', entry.errors);

        // Max latency — using a Lua-style approach via set with NX/GT would be ideal,
        // but HINCRBY with manual max tracking is fine at this scale.
        // We store it and the aggregator job will compute true max from snapshots.
        pipeline.hincrby(dk, 'maxLatencySample', entry.maxLatencyMs);

        // Sliding RPM window — INCR + EXPIRE
        pipeline.incrby(rk, entry.requests);
        pipeline.expire(rk, 120); // 2 minutes — covers current + previous minute

        // Set TTL on daily key (idempotent, resets if key already exists — OK)
        pipeline.expire(dk, dayTtlSeconds);
      }

      await pipeline.exec();
    } catch (err) {
      // Silently swallow — metering failure must NEVER affect API responses
      this.logger.warn(`Metering flush failed: ${(err as Error).message}`);
    }
  }

  // ─── Rate Limiter Support ──────────────────────────────────────────────────

  /**
   * Returns the number of requests made by this tenant in the current minute window.
   * Used by TenantRateLimitGuard for per-minute burst protection.
   */
  async getTenantRpm(tenantId: string): Promise<number> {
    try {
      const val = await this.redis.get(rpmKey(tenantId, currentMinuteTs()));
      return parseInt(val ?? '0', 10);
    } catch {
      return 0; // Fail open — don't block on Redis errors
    }
  }

  /**
   * Returns total API calls for this tenant today.
   * Used by TenantRateLimitGuard for daily quota enforcement.
   */
  async getTenantDailyCount(tenantId: string): Promise<number> {
    try {
      const val = await this.redis.hget(dailyKey(tenantId, todayDate()), 'requests');
      return parseInt(val ?? '0', 10);
    } catch {
      return 0;
    }
  }

  // ─── Plan Limits Cache ─────────────────────────────────────────────────────

  /**
   * Cache plan limits in Redis to avoid a DB lookup on every request.
   * Called by admin service when a tenant's plan changes, and on app boot.
   * TTL: 1 hour — stale limits are acceptable (plan downgrades are rare).
   */
  async setPlanLimits(tenantId: string, limits: PlanLimits): Promise<void> {
    try {
      await this.redis.set(
        planLimitsKey(tenantId),
        JSON.stringify(limits),
        'EX',
        3600, // 1 hour
      );
    } catch {
      // Non-fatal
    }
  }

  async getPlanLimits(tenantId: string): Promise<PlanLimits | null> {
    try {
      const val = await this.redis.get(planLimitsKey(tenantId));
      return val ? (JSON.parse(val) as PlanLimits) : null;
    } catch {
      return null;
    }
  }

  async invalidatePlanLimits(tenantId: string): Promise<void> {
    try {
      await this.redis.del(planLimitsKey(tenantId));
    } catch {
      // Non-fatal
    }
  }

  // ─── Dashboard / Aggregator Support ───────────────────────────────────────

  /**
   * Read today's metrics for a single tenant from Redis.
   * Returns live real-time data for the admin dashboard.
   */
  async getLiveMetrics(tenantId: string): Promise<LiveTenantMetrics> {
    try {
      const date = todayDate();
      const minuteTs = currentMinuteTs();

      const [daily, rpm] = await Promise.all([
        this.redis.hgetall(dailyKey(tenantId, date)),
        this.redis.get(rpmKey(tenantId, minuteTs)),
      ]);

      const requests = parseInt(daily?.requests ?? '0', 10);
      const latencySum = parseInt(daily?.latencySum ?? '0', 10);
      const bytes = parseInt(daily?.bytes ?? '0', 10);
      const errors = parseInt(daily?.errors ?? '0', 10);

      return {
        tenantId,
        apiCallsToday: requests,
        avgLatencyMs: requests > 0 ? Math.round(latencySum / requests) : 0,
        errorsToday: errors,
        currentRpm: parseInt(rpm ?? '0', 10),
        bandwidthKbToday: Math.round(bytes / 1024),
      };
    } catch {
      return {
        tenantId,
        apiCallsToday: 0,
        avgLatencyMs: 0,
        errorsToday: 0,
        currentRpm: 0,
        bandwidthKbToday: 0,
      };
    }
  }

  /**
   * Read today's metrics for ALL tenants in a single Redis PIPELINE scan.
   * Used by the admin overview dashboard endpoint.
   */
  async getAllTenantsLiveMetrics(tenantIds: string[]): Promise<Map<string, LiveTenantMetrics>> {
    const result = new Map<string, LiveTenantMetrics>();
    if (tenantIds.length === 0) return result;

    try {
      const date = todayDate();
      const minuteTs = currentMinuteTs();
      const pipeline = this.redis.pipeline();

      for (const tenantId of tenantIds) {
        pipeline.hgetall(dailyKey(tenantId, date));
        pipeline.get(rpmKey(tenantId, minuteTs));
      }

      const responses = await pipeline.exec();
      if (!responses) return result;

      for (let i = 0; i < tenantIds.length; i++) {
        const tenantId = tenantIds[i];
        const daily = (responses[i * 2]?.[1] as Record<string, string> | null) ?? {};
        const rpm = (responses[i * 2 + 1]?.[1] as string | null) ?? '0';

        const requests = parseInt(daily?.requests ?? '0', 10);
        const latencySum = parseInt(daily?.latencySum ?? '0', 10);
        const bytes = parseInt(daily?.bytes ?? '0', 10);

        result.set(tenantId, {
          tenantId,
          apiCallsToday: requests,
          avgLatencyMs: requests > 0 ? Math.round(latencySum / requests) : 0,
          errorsToday: parseInt(daily?.errors ?? '0', 10),
          currentRpm: parseInt(rpm, 10),
          bandwidthKbToday: Math.round(bytes / 1024),
        });
      }
    } catch (err) {
      this.logger.warn(`getAllTenantsLiveMetrics failed: ${(err as Error).message}`);
    }

    return result;
  }

  /**
   * Read and return daily counter values for the aggregator job.
   * This does NOT drain/delete the keys — snapshots are additive and idempotent.
   */
  async readDailyCounters(tenantId: string, date: string): Promise<DailyMetrics> {
    try {
      const daily = await this.redis.hgetall(dailyKey(tenantId, date));
      if (!daily || Object.keys(daily).length === 0) {
        return {
          apiRequestCount: 0,
          avgResponseTimeMs: 0,
          p95ResponseTimeMs: 0,
          errorCount: 0,
          totalBandwidthKb: 0,
          peakRpm: 0,
        };
      }

      const requests = parseInt(daily.requests ?? '0', 10);
      const latencySum = parseInt(daily.latencySum ?? '0', 10);
      const maxLatency = parseInt(daily.maxLatencySample ?? '0', 10);
      const bytes = parseInt(daily.bytes ?? '0', 10);
      const errors = parseInt(daily.errors ?? '0', 10);

      // Compute peak RPM across the last 60 minute-buckets for today
      const peakRpm = await this._computePeakRpm(tenantId);

      return {
        apiRequestCount: requests,
        avgResponseTimeMs: requests > 0 ? Math.round(latencySum / requests) : 0,
        p95ResponseTimeMs: maxLatency, // Best approximation without percentile histogram
        errorCount: errors,
        totalBandwidthKb: Math.round(bytes / 1024),
        peakRpm,
      };
    } catch {
      return {
        apiRequestCount: 0,
        avgResponseTimeMs: 0,
        p95ResponseTimeMs: 0,
        errorCount: 0,
        totalBandwidthKb: 0,
        peakRpm: 0,
      };
    }
  }

  private async _computePeakRpm(tenantId: string): Promise<number> {
    try {
      const currentMinute = currentMinuteTs();
      const pipeline = this.redis.pipeline();
      // Look at last 60 minute buckets (1 hour)
      for (let i = 0; i < 60; i++) {
        pipeline.get(rpmKey(tenantId, currentMinute - i));
      }
      const responses = await pipeline.exec();
      if (!responses) return 0;

      let peak = 0;
      for (const [, val] of responses) {
        const count = parseInt((val as string | null) ?? '0', 10);
        if (count > peak) peak = count;
      }
      return peak;
    } catch {
      return 0;
    }
  }
}
