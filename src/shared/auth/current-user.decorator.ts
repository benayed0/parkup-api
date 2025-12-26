import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { ALLOWED_USER_TYPES_KEY, UserType } from './combined-jwt-auth.guard';

/**
 * Decorator to extract the current authenticated user (operator or agent) from request.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Decorator to get the user type ('operator' or 'agent').
 */
export const CurrentUserType = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): 'operator' | 'agent' => {
    const request = ctx.switchToHttp().getRequest();
    return request.userType;
  },
);

/**
 * Decorator to restrict endpoint to specific user types.
 * Use with CombinedJwtAuthGuard.
 * @example @AllowedUserTypes('operator') // Only operators
 * @example @AllowedUserTypes('agent') // Only agents
 * @example @AllowedUserTypes('operator', 'agent') // Both (default)
 */
export const AllowedUserTypes = (...types: UserType[]) =>
  SetMetadata(ALLOWED_USER_TYPES_KEY, types);
