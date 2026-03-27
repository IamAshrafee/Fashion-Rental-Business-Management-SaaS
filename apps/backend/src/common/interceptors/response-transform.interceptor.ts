import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps all successful responses in the standard API format:
 * { success: true, data: T, message?: string }
 *
 * If the controller already returns an object with `success` property,
 * it's passed through unchanged (to support paginated responses).
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        // If already formatted (has success property), pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
