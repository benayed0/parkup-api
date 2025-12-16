import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
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
