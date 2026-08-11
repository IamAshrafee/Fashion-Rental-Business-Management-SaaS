import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationListener } from './notification.listener';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogListener } from './audit-log.listener';
import { SmsService } from './sms/sms.service';
import { DevSmsService } from './sms/dev-sms.service';
import { SMS_PROVIDER_TOKEN } from './sms/sms.interface';
import { HttpSmsService } from './sms/http-sms.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [NotificationController, AuditLogController],
  providers: [
    NotificationService,
    NotificationListener,
    AuditLogService,
    AuditLogListener,
    SmsService,
    DevSmsService,
    HttpSmsService,
    {
      provide: SMS_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('nodeEnv') === 'production' ? new HttpSmsService(config) : new DevSmsService(),
    },
  ],
  exports: [NotificationService, AuditLogService, SmsService],
})
export class NotificationModule {}
