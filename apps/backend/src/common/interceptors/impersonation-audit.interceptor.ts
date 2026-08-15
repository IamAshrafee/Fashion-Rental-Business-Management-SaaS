import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { Observable, concatMap } from 'rxjs';
import type { AuthUser } from '@closetrent/types';
import { PrismaService } from '../../prisma/prisma.service';

type AuthenticatedRequest = Request & { user?: AuthUser; tenant?: { id?: string } };

@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ImpersonationAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const method = request.method.toUpperCase();
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (!isMutation || !user?.isImpersonation || !user.impersonatorId || !user.tenantId) {
      return next.handle();
    }

    return next.handle().pipe(concatMap(async (data) => {
      const routePath = request.route?.path
        ? `${request.baseUrl || ''}${String(request.route.path)}`
        : request.path;
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId: user.tenantId!,
            userId: user.impersonatorId!,
            action: `admin.impersonated_${method.toLowerCase()}`,
            entityType: 'http_route',
            entityId: String(request.params?.id || routePath).slice(0, 200),
            newValues: {
              route: routePath,
              method,
              targetUserId: user.id,
              impersonationSessionId: user.sessionId,
            } as Prisma.InputJsonValue,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent']?.slice(0, 500),
          },
        });
      } catch (error) {
        this.logger.error('Failed to persist impersonated mutation audit', error);
      }
      return data;
    }));
  }
}
