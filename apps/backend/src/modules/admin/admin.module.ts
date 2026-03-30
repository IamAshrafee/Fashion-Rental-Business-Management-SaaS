import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin Module.
 * Implements SaaS platform operations: tenant management, platform stats, subscription plans.
 * EventEmitter2 is global (registered in AppModule) — no import needed here.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'jwt.secret',
          'dev-jwt-secret-change-in-production',
        ),
        signOptions: {
          expiresIn: '1h', // Impersonation token valid for 1 hour
        },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
