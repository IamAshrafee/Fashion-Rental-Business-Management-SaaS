import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthUser } from '@closetrent/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'jwt.secret',
        'dev-jwt-secret-change-in-production',
      ),
    });
  }

  /**
   * Called by Passport after successfully verifying the JWT.
   * The returned value is attached to `req.user`.
   *
   * Note: We do NOT check the session against the DB here.
   * Access tokens are stateless (15 min TTL). Session validation
   * only happens on refresh. This is per ADR/authentication.md.
   */
  validate(payload: JwtPayload): AuthUser {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: payload.sub,
      email: null, // Not in JWT — load from DB if needed
      phone: null,
      role: payload.role,
      tenantId: payload.tenantId,
      sessionId: payload.sessionId,
    };
  }
}
