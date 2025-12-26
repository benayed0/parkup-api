import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AgentJwtAuthGuard extends AuthGuard('agent-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, agent: any, info: any) {
    if (err || !agent) {
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
    return agent;
  }
}
