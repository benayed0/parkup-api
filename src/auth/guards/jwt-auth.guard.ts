import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);
    if (result) {
      const request = context.switchToHttp().getRequest();
      request.user = this.getRequest(context).user;
    }
    return result as boolean;
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest();
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
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

    // Explicitly assign user to request
    const request = context.switchToHttp().getRequest();
    request.user = user;

    return user;
  }
}
