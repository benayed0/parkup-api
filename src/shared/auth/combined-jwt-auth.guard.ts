import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const ALLOWED_USER_TYPES_KEY = 'allowedUserTypes';
export type UserType = 'operator' | 'agent';

/**
 * Combined JWT Auth Guard that accepts either operator or agent tokens.
 * Sets request.userType to indicate which type of user is authenticated.
 */
@Injectable()
export class CombinedJwtAuthGuard extends AuthGuard(['operator-jwt', 'agent-jwt']) {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get allowed user types from decorator (defaults to both)
    const allowedTypes = this.reflector.getAllAndOverride<UserType[]>(
      ALLOWED_USER_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    ) || ['operator', 'agent'];

    // Try operator-jwt strategy first
    try {
      const operatorGuard = new (AuthGuard('operator-jwt'))();
      const operatorResult = await operatorGuard.canActivate(context);
      if (operatorResult) {
        // Re-fetch request since canActivate may have modified it
        const req = context.switchToHttp().getRequest();
        if (req.user) {
          req.userType = 'operator';
          if (!allowedTypes.includes('operator')) {
            throw new UnauthorizedException('Les opérateurs ne sont pas autorisés pour cette action');
          }
          return true;
        }
      }
    } catch (e) {
      // Operator auth failed, try agent
    }

    // Try agent-jwt strategy
    try {
      const agentGuard = new (AuthGuard('agent-jwt'))();
      const agentResult = await agentGuard.canActivate(context);
      if (agentResult) {
        const req = context.switchToHttp().getRequest();
        if (req.user) {
          req.userType = 'agent';
          if (!allowedTypes.includes('agent')) {
            throw new UnauthorizedException('Les agents ne sont pas autorisés pour cette action');
          }
          return true;
        }
      }
    } catch (e) {
      // Both failed
    }

    throw new UnauthorizedException({
      error: 'Token invalide ou manquant',
      code: 'UNAUTHORIZED',
    });
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          error: 'Token expiré',
          code: 'TOKEN_EXPIRED',
        });
      }
      throw new UnauthorizedException({
        error: 'Token invalide ou manquant',
        code: 'UNAUTHORIZED',
      });
    }
    return user;
  }
}
