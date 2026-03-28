import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationListener } from './notification.listener';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { SmsService } from './sms/sms.service';
import { DevSmsService } from './sms/dev-sms.service';
import { SMS_PROVIDER_TOKEN } from './sms/sms.interface';

@Module({
  controllers: [NotificationController, AuditLogController],
  providers: [
    NotificationService,
    NotificationListener,
    AuditLogService,
    SmsService,
    // Provide the SMS adapter — swap DevSmsService for a real provider in production
    {
      provide: SMS_PROVIDER_TOKEN,
      useClass: DevSmsService,
    },
  ],
  exports: [NotificationService, AuditLogService, SmsService],
})
export class NotificationModule {}
