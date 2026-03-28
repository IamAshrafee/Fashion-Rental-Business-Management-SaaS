import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';

// Middleware
import { TenantMiddleware } from './common/middleware/tenant.middleware';

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

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Event system (ADR-05, ADR-27)
    EventEmitterModule.forRoot(),

    // Database
    PrismaModule,

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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
