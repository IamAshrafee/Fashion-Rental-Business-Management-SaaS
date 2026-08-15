import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../notification/sms/sms.service';

@Injectable()
export class AuthNotificationListener {
  private readonly logger = new Logger(AuthNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('auth.passwordResetRequested')
  async onPasswordResetRequested(event: {
    userId: string;
    resetToken: string;
    expiresAt: Date;
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: event.userId },
      select: { phone: true, email: true },
    });
    if (!user?.phone) {
      this.logger.error(
        `Cannot deliver password reset for user ${event.userId}: no SMS-capable phone is registered`,
      );
      return;
    }

    const appUrl = this.config.get<string>('appUrl', 'http://localhost:3000').replace(/\/$/, '');
    const query = new URLSearchParams({
      identifier: user.phone,
      token: event.resetToken,
    });
    const resetUrl = `${appUrl}/reset-password?${query.toString()}`;
    const expiresMinutes = Math.max(
      1,
      Math.ceil((event.expiresAt.getTime() - Date.now()) / 60_000),
    );

    try {
      await this.sms.send(user.phone, 'password_reset', { resetUrl, expiresMinutes });
    } catch (error) {
      this.logger.error(
        `Password-reset delivery failed for user ${event.userId}: ${(error as Error).message}`,
      );
    }
  }
}
