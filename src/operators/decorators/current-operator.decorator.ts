import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OperatorDocument } from '../schemas/operator.schema';

/**
 * Decorator to extract the current authenticated operator from the request.
 *
 * @example
 * @Get('me')
 * getProfile(@CurrentOperator() operator: OperatorDocument) {
 *   return operator;
 * }
 */
export const CurrentOperator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): OperatorDocument => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
