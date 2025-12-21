import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OperatorRole, ROLE_HIERARCHY } from '../schemas/operator.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OperatorRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user: operator } = context.switchToHttp().getRequest();

    if (!operator || !operator.role) {
      throw new ForbiddenException('Accès refusé: rôle non défini');
    }

    const operatorHierarchy = ROLE_HIERARCHY[operator.role as OperatorRole];

    // Check if operator's role hierarchy is >= any of the required roles
    const hasAccess = requiredRoles.some(
      (role) => operatorHierarchy >= ROLE_HIERARCHY[role],
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Accès refusé: vous devez avoir au moins le rôle ${requiredRoles.join(' ou ')}`,
      );
    }

    return true;
  }
}
