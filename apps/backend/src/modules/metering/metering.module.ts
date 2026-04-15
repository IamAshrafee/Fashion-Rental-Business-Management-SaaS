import { Module, Global } from '@nestjs/common';
import { MeteringService } from './metering.service';
import { MeteringInterceptor } from './metering.interceptor';

/**
 * MeteringModule
 *
 * Global module — MeteringService is available for injection everywhere:
 *   - MeteringInterceptor (registered globally in AppModule)
 *   - TenantRateLimitGuard (global guard in AppModule)
 *   - AdminService (dashboard data)
 *   - JobsService (aggregator jobs)
 *
 * Does NOT import PrismaModule — metering is Redis-only for hot paths.
 * PrismaService is injected separately by consumers that need DB writes.
 */
@Global()
@Module({
  providers: [MeteringService, MeteringInterceptor],
  exports: [MeteringService, MeteringInterceptor],
})
export class MeteringModule {}
