import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthListener } from './auth.listener';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'jwt.secret',
          'dev-jwt-secret-change-in-production',
        ),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessExpiry', '15m'),
        },
      }),
    }),
    TenantModule,
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, SessionService, JwtStrategy, AuthListener],
  exports: [AuthService, SessionService, JwtStrategy],
})
export class AuthModule {}
