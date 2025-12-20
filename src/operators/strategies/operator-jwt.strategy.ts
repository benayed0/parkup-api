import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { OperatorsService } from '../operators.service';
import { OperatorRole } from '../schemas/operator.schema';

export interface OperatorJwtPayload {
  sub: string;
  email: string;
  role: OperatorRole;
  type: 'operator';
}

@Injectable()
export class OperatorJwtStrategy extends PassportStrategy(Strategy, 'operator-jwt') {
  constructor(
    private configService: ConfigService,
    private operatorsService: OperatorsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: OperatorJwtPayload) {
    if (payload.type !== 'operator') {
      throw new UnauthorizedException('Token invalide pour opérateur');
    }

    try {
      const operator = await this.operatorsService.validateOperatorToken(payload);
      return operator;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
