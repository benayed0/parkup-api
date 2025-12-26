import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AgentsService } from '../agents.service';

export interface AgentJwtPayload {
  sub: string;
  username: string;
  type: 'agent';
}

@Injectable()
export class AgentJwtStrategy extends PassportStrategy(Strategy, 'agent-jwt') {
  constructor(
    private configService: ConfigService,
    private agentsService: AgentsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AgentJwtPayload) {
    if (payload.type !== 'agent') {
      throw new UnauthorizedException('Token invalide pour agent');
    }

    try {
      const agent = await this.agentsService.validateFromToken(payload);
      return agent;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
