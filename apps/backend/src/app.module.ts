import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';

// Middleware
import { TenantMiddleware } from './common/middleware/tenant.middleware';

// Metering (Resource Governance & Observability)
import { MeteringModule } from './modules/metering/metering.module';
import { MeteringInterceptor } from './modules/metering/metering.interceptor';
import { TenantRateLimitGuard } from './common/guards/tenant-rate-limit.guard';

// Application modules
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { ProductModule } from './modules/product/product.module';
import { BookingModule } from './modules/booking/booking.module';
import { CustomerModule } from './modules/customer/customer.module';
import { PaymentModule } from './modules/payment/payment.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { StaffModule } from './modules/staff/staff.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { SizeSchemaModule } from './modules/size-schema/size-schema.module';
import { SizeInstanceModule } from './modules/size-instance/size-instance.module';
import { ProductTypeModule } from './modules/product-type/product-type.module';
import { PricingEngineModule } from './modules/pricing-engine/pricing-engine.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),

    // Event system (ADR-05, ADR-27)
    EventEmitterModule.forRoot(),

    // Database
    PrismaModule,

    // Resource Governance & Metering (replaces ThrottlerModule)
    // Global — MeteringService available everywhere without re-importing
    MeteringModule,

    // Application modules
    AuthModule,
    TenantModule,
    ProductModule,
    BookingModule,
    CustomerModule,
    PaymentModule,
    UploadModule,
    NotificationModule,
    AdminModule,
    StaffModule,
    FulfillmentModule,
    AnalyticsModule,
    JobsModule,
    SizeSchemaModule,
    SizeInstanceModule,
    ProductTypeModule,
    PricingEngineModule,
  ],
  providers: [
    // Global metering interceptor — captures per-tenant API metrics on every request.
    // Runs AFTER response (tap operator) — zero latency impact.
    {
      provide: APP_INTERCEPTOR,
      useClass: MeteringInterceptor,
    },
    // Global per-tenant rate limiter — replaces ThrottlerModule.
    // Plan-aware: Free=60rpm, Pro=180rpm, Enterprise=600rpm.
    {
      provide: APP_GUARD,
      useClass: TenantRateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}

