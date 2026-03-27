import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = extractIpAddress(req);

    return this.authService.register(dto, { ua, ip });
  }

  /**
   * POST /api/v1/auth/login
   * Login with email or phone + password.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = extractIpAddress(req);

    return this.authService.login(dto, { ua, ip });
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /**
   * POST /api/v1/auth/logout
   * Revoke current session.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser) {
    await this.authService.logout(user.sessionId, user.id);
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
