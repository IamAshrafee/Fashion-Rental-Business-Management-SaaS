import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CheckSubdomainDto } from './dto/check-subdomain.dto';
import { TenantService } from '../tenant/tenant.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '@closetrent/types';
import { parseUserAgent } from '../../common/utils/user-agent';
import { extractIpAddress } from '../../common/utils/ip';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
  ) {}

  /**
   * POST /api/v1/auth/register
   * Register a new business owner + create tenant.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = extractIpAddress(req);

    const result = await this.authService.register(dto, { ua, ip });

    const cookieDomain = process.env.NODE_ENV === 'production' 
      ? `.${process.env.BASE_DOMAIN || 'closetrent.com'}`
      : undefined;

    res.cookie('closetrent_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: cookieDomain,
    });

    return result;
  }

  /**
   * POST /api/v1/auth/login
   * Login with email or phone + password.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = extractIpAddress(req);

    const result = await this.authService.login(dto, { ua, ip });

    const cookieDomain = process.env.NODE_ENV === 'production' 
      ? `.${process.env.BASE_DOMAIN || 'closetrent.com'}`
      : undefined;

    res.cookie('closetrent_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: cookieDomain,
    });

    return result;
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: RefreshTokenDto) {
    // Read from body (fallback) or HTTP-only cookie
    const token = dto.refreshToken || req.cookies?.closetrent_refresh;
    if (!token) throw new UnauthorizedException('No refresh token provided');

    const result = await this.authService.refreshTokens(token);

    const cookieDomain = process.env.NODE_ENV === 'production' 
      ? `.${process.env.BASE_DOMAIN || 'closetrent.com'}`
      : undefined;

    res.cookie('closetrent_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: cookieDomain,
    });

    return result;
  }

  /**
   * POST /api/v1/auth/logout
   * Revoke current session.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sessionId, user.id);
    const cookieDomain = process.env.NODE_ENV === 'production' 
      ? `.${process.env.BASE_DOMAIN || 'closetrent.com'}`
      : undefined;
      
    res.clearCookie('closetrent_refresh', { 
      path: '/api/v1/auth/refresh',
      domain: cookieDomain,
    });
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Initiate password reset.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /api/v1/auth/reset-password
   * Complete password reset with token.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * GET /api/v1/auth/me
   * Get current user profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id, user.tenantId);
  }

  /**
   * POST /api/v1/auth/check-subdomain
   * Check if a subdomain is available.
   */
  @Public()
  @Post('check-subdomain')
  @HttpCode(HttpStatus.OK)
  async checkSubdomain(@Body() dto: CheckSubdomainDto) {
    const available = await this.tenantService.isSubdomainAvailable(dto.subdomain);
    return { available };
  }
}
