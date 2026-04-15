import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { MeteringService, PlanLimits } from '../../modules/metering/metering.service';
import { Request } from 'express';



/**
 * Skip rate limiting decorator — use on admin or internal routes.
 * Example: @SkipTenantRateLimit()
 */
export const SKIP_RATE_LIMIT_KEY = 'skipTenantRateLimit';

// ─── Default Plan Limits (fallback when DB unreachable) ──────────────────────

const DEFAULT_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxRpm: 60,
    maxApiCallsDaily: 5_000,
    maxStorageMb: 500,
  },
  pro: {
    maxRpm: 180,
    maxApiCallsDaily: 50_000,
    maxStorageMb: 5_000,
  },
  enterprise: {
    maxRpm: 600,
    maxApiCallsDaily: null, // unlimited
    maxStorageMb: null,     // unlimited
  },
};

const FALLBACK_LIMITS: PlanLimits = {
  maxRpm: 120,           // Conservative default if plan unknown
  maxApiCallsDaily: null, // Don't block if we can't determine plan
  maxStorageMb: null,
};

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * TenantRateLimitGuard
 *
 * Enforces per-tenant, plan-aware rate limits using Redis sliding windows.
 *
 * Two checks:
 *   1. Per-minute burst limit (RPM) — prevents noisy neighbor spikes
 *   2. Daily quota — enforces plan API call limits
 *
 * Performance:
 *   - Plan limits cached in Redis (1hr TTL) → 1 Redis GET per request
 *   - RPM check uses existing meter:rpm keys from MeteringService → 1 Redis GET
 *   - Total overhead per request: ~2 Redis GETs = ~0.2ms
 *
 * Fail-open: if Redis is unreachable, requests pass through rather than block.
 * Non-tenant routes (admin, auth) skip this guard entirely.
 */
@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TenantRateLimitGuard.name);

  constructor(
    private readonly meteringService: MeteringService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check skip decorator
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const tenantId = req.tenant?.id;

    // Non-tenant routes (admin, auth, public health) are not rate-limited here
    if (!tenantId) return true;

    try {
      // ── 1. Get plan limits (cached in Redis, fallback to DB) ───────────────
      const limits = await this.resolvePlanLimits(tenantId);

      // ── 2. Check RPM burst limit (noisy neighbor protection) ───────────────
      const rpm = await this.meteringService.getTenantRpm(tenantId);

      if (rpm >= limits.maxRpm) {
        this.logger.warn(
          `Tenant ${tenantId} RPM limit hit: ${rpm}/${limits.maxRpm}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded. Your plan allows ${limits.maxRpm} requests per minute.`,
            retryAfterSeconds: 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // ── 3. Check daily quota (plan enforcement) ────────────────────────────
      if (limits.maxApiCallsDaily !== null) {
        const dailyCount = await this.meteringService.getTenantDailyCount(tenantId);

        if (dailyCount >= limits.maxApiCallsDaily) {
          this.logger.warn(
            `Tenant ${tenantId} daily quota hit: ${dailyCount}/${limits.maxApiCallsDaily}`,
          );
          const secondsUntilMidnight = this.secondsUntilMidnight();
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: `Daily API limit reached. Your plan allows ${limits.maxApiCallsDaily.toLocaleString()} requests per day. Quota resets at midnight UTC.`,
              retryAfterSeconds: secondsUntilMidnight,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      return true;
    } catch (err) {
      // Re-throw HttpExceptions (our 429s)
      if (err instanceof HttpException) throw err;

      // Any Redis/DB error → fail open (don't block legitimate requests)
      this.logger.warn(`Rate limit check failed for ${tenantId}: ${(err as Error).message}`);
      return true;
    }
  }

  /**
   * Resolve plan limits with Redis caching.
   * Cache miss → fetch from DB → cache for 1 hour.
   * Fallback to conservative defaults if DB unreachable.
   */
  private async resolvePlanLimits(tenantId: string): Promise<PlanLimits> {
    // 1. Try Redis cache first
    const cached = await this.meteringService.getPlanLimits(tenantId);
    if (cached) return cached;

    // 2. Fetch from DB
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
        select: {
          plan: {
            select: {
              slug: true,
              maxRpm: true,
              maxApiCallsDaily: true,
              maxStorageMb: true,
            },
          },
        },
      });

      const plan = subscription?.plan;
      if (!plan) return FALLBACK_LIMITS;

      // Build limits — prefer DB values, fall back to slug-based defaults
      const slugDefaults = DEFAULT_LIMITS[plan.slug] ?? FALLBACK_LIMITS;
      const limits: PlanLimits = {
        maxRpm: plan.maxRpm ?? slugDefaults.maxRpm,
        maxApiCallsDaily: plan.maxApiCallsDaily ?? slugDefaults.maxApiCallsDaily,
        maxStorageMb: plan.maxStorageMb ?? slugDefaults.maxStorageMb,
      };

      // 3. Cache in Redis for 1 hour
      await this.meteringService.setPlanLimits(tenantId, limits);
      return limits;
    } catch {
      return FALLBACK_LIMITS;
    }
  }

  private secondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  }
}
