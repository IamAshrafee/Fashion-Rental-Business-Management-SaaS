import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@closetrent/types';

/**
 * Role-Based Access Control Guard (stub).
 * Will be fully implemented in P03 (Auth & Tenant System).
 * Checks if the authenticated user has one of the required roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    // TODO: P03 will implement actual role checking from req.user
    this.logger.warn('RolesGuard is a stub — allowing all requests');
    return true;
  }
}
